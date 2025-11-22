# Diagnosis: Why `getOrderById` Verification is Slow

## Current Implementation

The `getOrderById` function performs a **two-step process**:

1. **Step 1 - Verification Query** (the slow part):
   ```typescript
   .from('orders')
   .select('id, shop_id, status')
   .eq('id', orderId)
   .eq('shop_id', shopId)
   .single()
   ```

2. **Step 2 - Full Query** (with all relations):
   ```typescript
   .select(`
     *,
     order_items(*),
     shop:shops(...),
     delivery_runner:delivery_runners(...)
   `)
   ```

## Root Causes of Slowness

### 1. **Complex RLS Policy Evaluation** ⚠️ PRIMARY BOTTLENECK

The RLS policy for merchants requires a complex EXISTS subquery with JOINs:

```sql
USING (
  EXISTS (
    SELECT 1 FROM public.shops s
    JOIN public.merchant_accounts ma ON ma.id = s.merchant_id
    WHERE s.id = orders.shop_id
      AND ma.user_id = auth.uid()
  )
)
```

**Why it's slow:**
- **Every query** must execute this EXISTS subquery
- Requires **2 JOINs** (shops → merchant_accounts)
- Must check `auth.uid()` (JWT token validation)
- Even though you're filtering by `shop_id`, RLS still evaluates the policy
- The database must check if the merchant owns the shop on **every single query**

**Performance Impact:** This adds 50-500ms+ depending on:
- Database load
- Network latency to Supabase
- JWT token validation time
- Index efficiency

### 2. **Unnecessary Two-Step Process** ⚠️ SECONDARY ISSUE

The verification step is **redundant** because:
- The full query (Step 2) already does the same RLS check
- You're making **2 database round trips** instead of 1
- Both queries execute the same RLS policy
- The verification query doesn't provide any value that the full query doesn't

**Performance Impact:** Doubles the query time (2x RLS evaluation)

### 3. **JWT Token Validation Overhead**

Every Supabase query must:
- Validate the JWT token
- Extract `auth.uid()` from the token
- Use it in the RLS policy check

**Performance Impact:** 10-50ms per query

### 4. **Network Latency**

Each database query has network overhead:
- Request to Supabase API
- Supabase processes query
- Response back to client

**Performance Impact:** 50-200ms depending on:
- Geographic distance to Supabase
- Network conditions
- Supabase server load

### 5. **Database Index Efficiency**

While indexes exist:
- `idx_orders_shop_id` ✅
- `idx_shops_merchant_id` ✅
- `idx_merchant_accounts_user_id` ✅

The RLS policy still requires:
- Index lookup on `orders.shop_id`
- Join to `shops` table
- Join to `merchant_accounts` table
- Index lookup on `merchant_accounts.user_id`

**Performance Impact:** Even with indexes, JOINs add overhead

### 6. **Polling in `waitForStatusConfirmation`**

The `waitForStatusConfirmation` function polls `getOrderById` **every 1 second**:
- If verification takes 500ms, you're making 2 queries per second
- Over 30 seconds, that's **60 queries** (30 verification + 30 full queries)
- Each query executes the RLS policy

**Performance Impact:** Multiplies the slowness by the number of polls

## Solutions (Ordered by Impact)

### Solution 1: Remove Verification Step (HIGHEST IMPACT) ⭐

**Remove Step 1 entirely** - the full query already does the same check:

```typescript
export async function getOrderById(orderId: string, shopId?: string): Promise<OrderWithAll | null> {
  try {
    // Skip verification - go straight to full query
    // RLS policy will handle access control
    
    let fullQuery = supabase
      .from('orders')
      .select(`
        *,
        order_items(*),
        shop:shops(id, name, image_url, shop_type, address, latitude, longitude),
        delivery_runner:delivery_runners(id, name, phone_number)
      `)
      .eq('id', orderId);

    if (shopId) {
      fullQuery = fullQuery.eq('shop_id', shopId);
    }

    const { data, error } = await fullQuery.single();
    
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data as OrderWithAll;
  } catch (error: any) {
    console.error('❌ getOrderById: Error:', error);
    return null;
  }
}
```

**Expected Improvement:** **~50% faster** (eliminates 1 query + 1 RLS evaluation)

### Solution 2: Remove `waitForStatusConfirmation` (HIGH IMPACT) ⭐

Since we're using **fire-and-forget** updates, we don't need to poll:

```typescript
// REMOVE this function entirely
// WebSocket will confirm updates in real-time
```

**Expected Improvement:** **Eliminates 30+ queries** during status updates

### Solution 3: Optimize RLS Policy (MEDIUM IMPACT)

Create a **materialized view** or **function** that pre-computes merchant-shop relationships:

```sql
-- Create a function that's faster than EXISTS subquery
CREATE OR REPLACE FUNCTION merchant_owns_shop(p_shop_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM shops s
    INNER JOIN merchant_accounts ma ON ma.id = s.merchant_id
    WHERE s.id = p_shop_id
      AND ma.user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Use in RLS policy (if Supabase allows)
```

**Expected Improvement:** **10-20% faster** (if possible)

### Solution 4: Add Composite Index (LOW-MEDIUM IMPACT)

Ensure optimal index coverage:

```sql
-- Composite index for the RLS policy lookup
CREATE INDEX IF NOT EXISTS idx_shops_merchant_user 
  ON shops(merchant_id) 
  INCLUDE (id);
```

**Expected Improvement:** **5-10% faster**

### Solution 5: Use Direct Query with shop_id Filter (LOW IMPACT)

Since you're already filtering by `shop_id`, the RLS policy should be faster, but it still evaluates.

**Expected Improvement:** **Minimal** (RLS still runs)

## Recommended Action Plan

1. **Immediate (5 min):** Remove verification step from `getOrderById`
2. **Immediate (5 min):** Remove `waitForStatusConfirmation` calls (we're fire-and-forget now)
3. **Short-term (30 min):** Test RLS policy performance with EXPLAIN ANALYZE
4. **Long-term (if needed):** Consider RLS policy optimization or materialized views

## Expected Performance After Fixes

- **Before:** 500-2000ms per `getOrderById` call (2 queries + RLS)
- **After Solution 1:** 250-1000ms per call (1 query + RLS)
- **After Solution 2:** 0ms during status updates (no polling)

## Monitoring

Add timing logs to track improvement:

```typescript
const startTime = Date.now();
const result = await getOrderById(orderId, shopId);
const duration = Date.now() - startTime;
console.log(`⏱️ getOrderById took ${duration}ms`);
```

