# Diagnosis: WebSocket Status Update Issues

## Problem Summary
Status updates are slow and require manual reload because:
1. **Merchant side**: Polling `getOrderById` instead of trusting WebSocket
2. **Consumer side**: Multiple debounces and polling fallbacks
3. **WebSocket not being primary mechanism**: Too many fallbacks and confirmations

---

## Current Flow Analysis

### MERCHANT SIDE Status Update Flow

#### Step 1: User clicks "Confirm Order"
1. `handleConfirm()` calls `confirmOrder()` 
2. `confirmOrder()` waits for database update (5s timeout) ✅
3. Updates cache optimistically via `onSuccess()`
4. **PROBLEM**: Then calls `waitForStatusConfirmation()` which:
   - Polls `getOrderById()` every 500ms
   - Continues for up to 15 seconds
   - Only closes modal after confirmation
   - **This is redundant!** WebSocket should handle this

#### Step 2: WebSocket Subscription (useShopOrders)
- Subscribes to `postgres_changes` on `orders` table
- Has 200ms debounce on invalidation
- Invalidates React Query cache
- Triggers refetch

**ISSUES:**
1. **Double confirmation**: Database update + polling confirmation
2. **Slow modal close**: Waits 15s max for polling confirmation
3. **WebSocket debounce**: 200ms delay before cache invalidation
4. **Not trusting WebSocket**: Polling as primary confirmation method

---

### CONSUMER SIDE Status Update Flow

#### Step 1: WebSocket Subscription (useOrder hook)
- Subscribes to single order updates
- Has 200ms debounce before updating cache
- Updates cache immediately after debounce
- Triggers background refetch after 100ms

#### Step 2: WebSocket Subscription (OrderApprovalContext)
- Subscribes to all user orders
- Has 200ms debounce before updating state
- Updates `activeOrder` state
- Closes modal on terminal states

**ISSUES:**
1. **Double debounce**: 200ms in useOrder + 200ms in OrderApprovalContext = 400ms total delay
2. **Polling fallback**: 3s interval polling as backup (adds unnecessary load)
3. **Multiple subscriptions**: Both hooks subscribe separately (could be optimized)
4. **Cache updates delayed**: Debouncing prevents immediate UI updates

---

## Root Causes

### 1. Merchant Side: Not Trusting WebSocket
```typescript
// Current: Polling confirmation
const confirmed = await waitForStatusConfirmation(order.id, 'confirmed', shopId);
// This polls getOrderById every 500ms for 15s - SLOW!

// Should be: Trust WebSocket
// WebSocket subscription in useShopOrders will update cache automatically
// No need for polling confirmation
```

### 2. Consumer Side: Too Much Debouncing
```typescript
// useOrder: 200ms debounce
const UPDATE_DEBOUNCE_MS = 200;

// OrderApprovalContext: Another 200ms debounce
const UPDATE_DEBOUNCE_MS = 200;

// Total delay: 400ms before UI updates
```

### 3. WebSocket Not Primary Mechanism
- Merchant side: Database update → Polling confirmation → WebSocket (redundant)
- Consumer side: WebSocket → Debounce → Debounce → Update (slow)
- Should be: Database update → WebSocket → Immediate cache update → UI update

---

## Solutions

### Solution 1: Remove Polling Confirmation (Merchant Side)
- Remove `waitForStatusConfirmation()` polling
- Trust WebSocket subscription to update cache
- Close modal immediately after database update succeeds
- WebSocket will confirm update in real-time

### Solution 2: Reduce/Remove Debouncing (Consumer Side)
- Remove debouncing from WebSocket callbacks
- Update cache immediately when WebSocket receives update
- Keep debouncing only for rapid-fire updates (if needed, reduce to 50ms)

### Solution 3: Make WebSocket Primary
- Database update → WebSocket notification → Immediate cache update
- No polling confirmation needed
- No excessive debouncing
- Trust WebSocket reliability

### Solution 4: Optimize WebSocket Subscriptions
- Ensure subscriptions are active before status updates
- Handle JWT token refresh properly
- Reduce reconnection delays
- Make subscriptions more reliable

---

## Expected Improvements

### Before (Current):
- Merchant: Database update (5s) → Polling confirmation (0-15s) → Modal closes = **5-20 seconds**
- Consumer: WebSocket (instant) → Debounce (200ms) → Debounce (200ms) → Update = **400ms+**

### After (Optimized):
- Merchant: Database update (5s) → WebSocket (instant) → Modal closes = **~5 seconds**
- Consumer: WebSocket (instant) → Immediate cache update → UI update = **<50ms**

---

## Implementation Priority

1. **HIGH**: Remove `waitForStatusConfirmation` polling from merchant side
2. **HIGH**: Reduce debouncing on consumer side (200ms → 50ms or remove)
3. **MEDIUM**: Optimize WebSocket subscription reliability
4. **LOW**: Remove polling fallbacks (keep as last resort only)

