# AroundYou - Local Delivery Platform (Web Application)
## Final Year Project Report

---

## 1. Executive Summary

AroundYou is a full-stack web-based local delivery platform connecting consumers with nearby shops. Built with React.js, TypeScript, and Supabase, it provides real-time order tracking, location-based shop discovery, and comprehensive merchant management tools. The system utilizes PostgreSQL with PostGIS for geospatial queries, WebSocket subscriptions for real-time updates, and a responsive design that works seamlessly on both desktop and mobile browsers.

---

## 2. Project Overview

### 2.1 Problem Statement

Local shops struggle to establish a digital presence and manage delivery operations efficiently. Consumers need an easy way to discover nearby shops and track their orders in real-time. The platform addresses both needs through a comprehensive web application.

### 2.2 Objectives

- Enable location-based shop discovery through web browser
- Provide real-time order tracking with WebSocket subscriptions
- Offer comprehensive merchant management tools for inventory, orders, and analytics
- Support multi-shop management for merchants
- Implement delivery area management with geospatial queries
- Create responsive design for desktop and mobile browsers

### 2.3 Target Users

- **Consumers**: Browse shops, place orders, track deliveries via web browser
- **Merchants**: Manage shops, inventory, orders, and analytics through web dashboard

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────┐
│      React.js Web Application       │
│  (Vite + TypeScript + Tailwind)     │
│                                     │
│  ┌─────────────┐  ┌──────────────┐ │
│  │  Consumer   │  │   Merchant   │ │
│  │   Portal    │  │   Portal     │ │
│  └─────────────┘  └──────────────┘ │
│                                     │
│  ┌───────────────────────────────┐ │
│  │   Shared Business Logic         │ │
│  │   (src/ directory)             │ │
│  │  - Services (API calls)         │ │
│  │  - Hooks (React Query)         │ │
│  │  - Contexts (State)            │ │
│  │  - Types (TypeScript)          │ │
│  └───────────────┬─────────────────┘ │
└──────────────────┼───────────────────┘
                   │
         ┌─────────▼──────────────┐
         │   Supabase Backend     │
         │  - PostgreSQL Database  │
         │  - PostGIS Extension    │
         │  - Realtime (WebSocket)│
         │  - Storage (Images)     │
         │  - Authentication       │
         └────────────────────────┘
```

### 3.2 Architecture Patterns

1. **Component-Based Architecture**: React functional components with hooks
2. **Service Layer Abstraction**: API calls abstracted in service files
3. **State Management**: React Query for server state, React Context for global state
4. **Real-Time Communication**: WebSocket subscriptions via Supabase Realtime
5. **Responsive Design**: Tailwind CSS for mobile-first responsive design

### 3.3 Project Structure

```
AroundYouFYP-main/
├── web/                    # React.js Web Application
│   ├── src/
│   │   ├── App.tsx        # Main app component
│   │   ├── main.tsx       # Entry point
│   │   ├── screens/       # Page components
│   │   │   ├── consumer/  # Consumer screens
│   │   │   └── merchant/  # Merchant screens
│   │   ├── components/    # Reusable components
│   │   ├── navigation/    # React Router setup
│   │   ├── context/       # React contexts
│   │   └── utils/         # Utility functions
│   ├── index.html         # HTML entry point
│   └── public/            # Static assets
│
├── src/                    # Shared Code
│   ├── services/          # API services (Supabase calls)
│   ├── hooks/             # Custom React hooks
│   ├── context/           # Shared contexts
│   ├── types/             # TypeScript definitions
│   └── utils/             # Utility functions
│
├── supabase/              # Database
│   └── migrations/        # SQL migration files
│
└── docs/                  # Documentation
```

---

## 4. Technology Stack

### 4.1 Frontend Technologies

| Technology | Purpose | Version |
|------------|---------|---------|
| React | UI Framework | 18.3.1 |
| TypeScript | Type Safety | 5.3.3 |
| Vite | Build Tool & Dev Server | 5.0.8 |
| Tailwind CSS | Styling Framework | 3.4.0 |
| React Query | Data Fetching & Caching | 4.x |
| React Router | Client-side Routing | 6.21.0 |
| React Hook Form | Form Handling | 7.53.0 |
| Zod | Schema Validation | 3.23.8 |
| Zustand | Client State Management | 4.x |
| Lucide React | Icon Library | 0.553.0 |

### 4.2 Backend Technologies

| Technology | Purpose |
|------------|---------|
| Supabase | Backend-as-a-Service Platform |
| PostgreSQL | Relational Database |
| PostGIS | Geospatial Extension |
| Supabase Realtime | WebSocket Subscriptions |
| Supabase Storage | Image Storage |
| Supabase Auth | Authentication System |

### 4.3 Development Tools

- **Vite**: Fast development server with Hot Module Replacement (HMR)
- **TypeScript**: Type checking and IntelliSense support
- **ESLint**: Code linting
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS vendor prefixing

---

## 5. Database Design

### 5.1 Core Tables

#### 5.1.1 User Management
- **`user_profiles`**: User accounts with roles (consumer, merchant, admin)
- **`merchant_accounts`**: Merchant registration and verification status
- **`consumer_addresses`**: User delivery addresses with geolocation (latitude/longitude)

#### 5.1.2 Shop Management
- **`shops`**: Shop information, location coordinates, status (open/closed)
- **`shop_delivery_areas`**: Delivery zones stored as PostGIS polygons
- **`shop_delivery_logic`**: Delivery fee configuration (distance tiers, thresholds)
- **`delivery_runners`**: Delivery personnel assigned to shops

#### 5.1.3 Inventory System
- **`item_templates`**: Global item catalog (immutable name, barcode, description)
- **`category_templates`**: Global category catalog
- **`merchant_items`**: Shop-specific items (can link to templates or be custom)
- **`merchant_categories`**: Shop-specific categories
- **`merchant_item_categories`**: Many-to-many relationship between items and categories
- **`audit_logs`**: Complete history of inventory changes with actor tracking

#### 5.1.4 Order Management
- **`orders`**: Order details with status workflow and timing calculations
- **`order_items`**: Order line items with price snapshots preserved at order time

### 5.2 Database Features

#### 5.2.1 PostGIS Integration
- **`shop_delivery_areas.geom`**: Stores polygons using `geometry(Polygon, 4326)`
- **Spatial Queries**: `ST_Contains()`, `ST_Intersects()`, `ST_IsValid()`
- **RPC Function**: `find_shops_by_location()` uses PostGIS to find shops whose delivery areas contain a point
- **GIST Indexes**: Spatial indexes on geometry columns for fast queries

#### 5.2.2 Database Triggers

1. **`create_default_delivery_logic()`**: Automatically creates default delivery logic when a shop is created
2. **`log_inventory_change()`**: Logs all inventory changes to audit_logs with field-level diffs
3. **`prevent_shop_delivery_area_overlap()`**: Prevents overlapping delivery areas for the same shop
4. **`validate_order_status_transition()`**: Validates order status transitions (e.g., can't go from pending to delivered)
5. **`update_*_updated_at()`**: Automatically updates `updated_at` timestamps

#### 5.2.3 Row Level Security (RLS)

**Consumer Access:**
- Users can only view/edit their own profile
- Users can only access their own addresses
- Users can only view their own orders

**Merchant Access:**
- Merchants can only access shops they own
- Merchants can only view/update orders for their shops
- Merchants can only manage inventory for their shops

**Public Access:**
- Anyone can view open shops
- Anyone can view active items from open shops
- Anyone can view delivery areas (for coverage checking)
- Anyone can view delivery logic (for fee calculation)

### 5.3 Order Status Workflow

```
pending → confirmed → out_for_delivery → delivered
   ↓
cancelled
```

**Status Transitions:**
- Each transition updates specific timestamps (`confirmed_at`, `out_for_delivery_at`, `delivered_at`)
- Calculates durations automatically (`confirmation_time_seconds`, `preparation_time_seconds`, `delivery_time_seconds`)
- Validates transitions via database triggers
- Prevents invalid transitions (e.g., can't go from delivered back to pending)

---

## 6. Features and Functionality

### 6.1 Consumer Features

#### 6.1.1 Location-Based Shop Discovery
- **PostGIS Query**: Uses `find_shops_by_location()` RPC function with PostGIS `ST_Contains()` to find shops whose delivery areas contain the user's location
- **Fallback Mechanism**: If RPC times out (20 seconds), falls back to returning all open shops (limit 30) without delivery area filtering
- **Delivery Fee Calculation**: Calculates delivery fees based on distance from consumer to shop using shop's delivery logic
- **Shop Display**: Shows shops with distance, delivery fee, and shop information

**Implementation:**
```typescript
// Primary: PostGIS RPC call
find_shops_by_location(POINT(longitude latitude))
  → Returns shops where ST_Contains(delivery_area, point)

// Fallback: Direct query
→ Fetch all open shops (limit 30)
→ Return without filtering (ensures users always see shops)
```

#### 6.1.2 Shopping Cart
- **Multi-Shop Support**: Separate carts for each shop
- **Persistent State**: Cart state managed with Zustand store
- **Real-Time Updates**: Cart updates when item prices change
- **Cart Management**: Add, remove, update quantities

#### 6.1.3 Order Placement
- **Address Selection**: Choose from saved addresses or add new one
- **Payment Method**: Select cash, card, or wallet
- **Special Instructions**: Add delivery notes
- **Order Number**: Auto-generated format `ORD-YYYYMMDD-NNNN`
- **Price Snapshots**: Item prices preserved at order time (prevents price changes affecting placed orders)

#### 6.1.4 Real-Time Order Tracking
- **WebSocket Subscriptions**: Real-time order status updates via Supabase Realtime
- **Status Updates**: Visual indicators for pending → confirmed → out_for_delivery → delivered
- **Delivery Runner Info**: Shows runner name and phone when order is out for delivery
- **Countdown Timers**: Displays time remaining for each stage
- **Order Cancellation**: Cancel orders with reason (before confirmation)

#### 6.1.5 Address Management
- **Multiple Addresses**: Save home, office, and custom addresses
- **Geocoding**: Automatically gets latitude/longitude from address
- **Address Search**: Search addresses with map integration
- **Address Validation**: Validates address format and location

### 6.2 Merchant Features

#### 6.2.1 Multi-Shop Management
- **Shop Creation**: Create multiple shops from merchant dashboard
- **Shop Switching**: Switch between shops in dashboard
- **Shop-Specific Data**: All data (orders, inventory, analytics) scoped to selected shop
- **Shop Settings**: Configure shop details, images, status (open/closed)

#### 6.2.2 Inventory Management

**Item Management:**
- **Add/Edit Items**: Create items with name, description, image, price, SKU
- **Template Adoption**: Link items to global templates (template fields immutable, price/SKU editable)
- **Custom Items**: Create custom items without template linkage
- **Category Assignment**: Assign items to multiple categories (many-to-many)
- **Active/Inactive Status**: Enable/disable items without deleting
- **Bulk Operations**: Support for bulk updates (future enhancement)

**Category Management:**
- **Create Categories**: Create custom categories or adopt from templates
- **Organize Items**: Group items by category
- **Category Status**: Enable/disable categories

**Item Templates:**
- **Global Catalog**: Pre-defined items with name, barcode, description
- **Template Adoption**: Merchants can adopt templates and set their own prices
- **Immutable Fields**: Template name, barcode, description cannot be changed by merchants
- **Editable Fields**: Merchants can set price, SKU, categories, active status

**Audit Logging:**
- **Change Tracking**: All inventory changes logged automatically
- **Actor Tracking**: Records who made the change (user ID, role, email)
- **Field-Level Diffs**: Shows what changed (price, SKU, status, etc.)
- **Source Tracking**: Tracks source of change (manual, bulk import, etc.)
- **Filterable Log**: Filter by action type, field, date range, actor

#### 6.2.3 Order Management

**Order Status Workflow:**
- **Confirm Orders**: Change status from pending → confirmed
- **Assign Runner**: Assign delivery runner and change status to out_for_delivery
- **Mark Delivered**: Change status to delivered when customer receives order
- **Cancel Orders**: Cancel orders with reason (merchant or consumer)

**Order Features:**
- **Real-Time Notifications**: WebSocket subscriptions for instant order updates
- **Order Filtering**: Filter by status, date range, amount
- **Order Details**: View customer info, delivery address, items, payment method
- **Delivery Runner Assignment**: Assign runners to orders
- **Order History**: View past orders with complete details
- **Order Analytics**: Track order metrics and trends

**Status Update Implementation:**
- **Optimistic Updates**: UI updates immediately for instant feedback
- **Database Confirmation**: Polls database to confirm status change
- **WebSocket Updates**: Real-time updates via WebSocket subscription
- **Modal Behavior**: Status update modal waits for confirmation before closing

#### 6.2.4 Delivery Area Management

**Polygon-Based Delivery Zones:**
- **Map Interface**: Draw custom delivery areas on interactive map
- **PostGIS Storage**: Delivery areas stored as PostGIS polygons
- **Multiple Zones**: Create multiple delivery zones per shop
- **Overlap Prevention**: Database trigger prevents overlapping areas
- **Geometry Validation**: Validates polygon geometry before saving

**Delivery Logic Configuration:**
- **Distance Tiers**: Configure fee tiers based on distance (e.g., 0-200m: Rs 20, 200-400m: Rs 30)
- **Minimum Order Value**: Set minimum order value (e.g., Rs 200)
- **Small Order Surcharge**: Additional fee for orders below minimum (e.g., Rs 40)
- **Free Delivery**: Configure free delivery threshold and radius
- **Beyond-Tier Pricing**: Pricing for distances beyond configured tiers

#### 6.2.5 Analytics Dashboard

**Revenue Analytics:**
- **Time-Series Data**: Daily, weekly, monthly revenue trends
- **Revenue Charts**: Visual charts showing revenue over time
- **Order Volume**: Track number of orders over time
- **Revenue Breakdown**: Breakdown by shop, category, item

**Shop Performance:**
- **Total Orders**: Count of all orders
- **Total Revenue**: Sum of all order totals
- **Average Order Value**: Average order amount
- **Order Status Distribution**: Pie chart showing order status breakdown

**Item Analytics:**
- **Best Sellers**: Items with highest sales
- **Item Revenue**: Revenue per item
- **Times Sold**: Counter tracking how many times each item was sold

### 6.3 Real-Time Features

#### 6.3.1 WebSocket Subscriptions

**Order Subscriptions:**
- **Consumer Side**: Subscribe to individual order updates
- **Merchant Side**: Subscribe to all orders for a shop
- **Automatic Reconnection**: Exponential backoff reconnection on failure
- **Polling Fallback**: Falls back to polling if WebSocket fails

**Implementation Details:**
- Uses Supabase Realtime `postgres_changes` events
- Filters by `order_id` or `shop_id`
- Debounced updates (500ms) to prevent rapid-fire updates
- Cache invalidation triggers React Query refetch
- Optimistic UI updates for instant feedback

#### 6.3.2 Cache Management

**React Query Integration:**
- **Automatic Caching**: Caches API responses automatically
- **Deduplication**: Prevents duplicate API calls
- **Background Refetching**: Refetches stale data in background
- **Stale-While-Revalidate**: Shows cached data while fetching fresh data
- **Optimistic Updates**: Updates UI immediately, confirms with server

---

## 7. User Flows

### 7.1 Consumer Order Flow

```
1. User opens web app → Location permission/selection
2. Browse nearby shops → Location-based query with PostGIS
3. Select shop → View items organized by categories
4. Add items to cart → Cart state managed with Zustand
5. View cart → Review items and quantities
6. Proceed to checkout → Select delivery address
7. Place order → Order created with price snapshots
8. Order confirmation → Order number displayed
9. Order tracking page → Real-time status updates via WebSocket
10. Status updates → pending → confirmed → out_for_delivery → delivered
11. Order delivered → Option to review and rate shop
```

### 7.2 Merchant Order Management Flow

```
1. Merchant logs in → Redirected to merchant dashboard
2. Select shop → Choose shop from dropdown (if multiple shops)
3. Navigate to Orders tab → View all orders for selected shop
4. New order notification → WebSocket subscription detects new order
5. View order details → Customer info, items, delivery address
6. Confirm order → Status changes: pending → confirmed
7. Assign delivery runner → Select runner from list
8. Mark out for delivery → Status changes: confirmed → out_for_delivery
9. Mark as delivered → Status changes: out_for_delivery → delivered
10. View analytics → Revenue and performance metrics
```

### 7.3 Inventory Management Flow

```
1. Merchant navigates to Inventory tab → View items and categories
2. View items → Filter by category, search by name
3. Add new item → Choose template adoption or custom creation
4. Fill item details → Name, price, SKU, image, categories
5. Save item → Item created and audit log entry generated
6. Edit item → Update price, SKU, status, categories
7. Changes logged → Audit log tracks all changes
8. Item appears in shop → Consumer can view and order
```

### 7.4 Delivery Area Setup Flow

```
1. Merchant navigates to Delivery tab → View delivery areas
2. Click "Add Delivery Area" → Map interface opens
3. Draw polygon → Click points on map to create polygon
4. Validate geometry → Check polygon is valid and closed
5. Check for overlaps → Database validates no overlaps
6. Save area → PostGIS polygon stored in database
7. Configure delivery logic → Set distance tiers and fees
8. Test coverage → Check if addresses are within delivery areas
```

---

## 8. Implementation Details

### 8.1 Location Services

#### 8.1.1 Shop Discovery Algorithm

**Primary Method (PostGIS RPC):**
```typescript
// RPC Function: find_shops_by_location
// Input: POINT(longitude latitude) in WKT format
// Process:
//   1. Query shops with delivery areas
//   2. Use ST_Contains(delivery_area.geom, point) to filter
//   3. Return shops whose delivery areas contain the point
// Timeout: 20 seconds

// Example:
find_shops_by_location('POINT(74.3587 31.5204)')
  → Returns shops in Lahore area
```

**Fallback Method:**
```typescript
// If RPC times out:
//   1. Fetch all open shops (limit 30)
//   2. Return without delivery area filtering
//   3. Ensures users always see shops even if PostGIS is slow
```

#### 8.1.2 Delivery Fee Calculation

```typescript
calculateDeliveryFee(distance, deliveryLogic):
  1. Check if distance is within free delivery radius
     → If order value >= threshold: return 0
  2. Check distance against configured tiers
     → Find appropriate tier fee
  3. If distance exceeds all tiers
     → Calculate beyond-tier fee
  4. Apply small order surcharge if order value < minimum
  5. Return final delivery fee
```

### 8.2 Order Management

#### 8.2.1 Order Creation Process

```typescript
placeOrder(request):
  1. Validate user authentication
  2. Fetch and validate delivery address
  3. Calculate delivery fee based on distance
  4. Create order record with:
     - Auto-generated order number (ORD-YYYYMMDD-NNNN)
     - Price snapshots (item prices at order time)
     - Address snapshot (JSONB of full address)
     - Customer snapshot (name, email, phone)
  5. Create order_items records with:
     - Item price snapshots
     - Quantities
     - Subtotals
  6. Calculate totals (subtotal + delivery fee + surcharge)
  7. Return order with all relations (shop, items, address)
```

#### 8.2.2 Status Update Flow

```typescript
updateOrderStatus(orderId, newStatus):
  1. Validate status transition (database trigger)
  2. Update order status in database
  3. Set appropriate timestamp (confirmed_at, etc.)
  4. Calculate duration (confirmation_time_seconds, etc.)
  5. WebSocket broadcasts update to subscribers
  6. Frontend receives update via subscription
  7. React Query cache updated optimistically
  8. UI reflects change immediately
  9. Background refetch confirms update
```

### 8.3 Real-Time Implementation

#### 8.3.1 WebSocket Subscription Pattern

```typescript
subscribeToOrder(orderId, callback):
  1. Create unique channel name: `order:${orderId}:${timestamp}`
  2. Subscribe to postgres_changes on orders table
  3. Filter: `id=eq.${orderId}`
  4. On UPDATE event:
     - Extract new order data from payload
     - Call callback with updated order
     - Update React Query cache immediately
     - Trigger UI re-render
  5. Handle connection errors:
     - Exponential backoff reconnection (1s, 2s, 4s, max 8s)
     - Max 3 reconnection attempts
     - Fallback to polling if WebSocket fails
  6. Cleanup on unmount
```

#### 8.3.2 Cache Update Strategy

```typescript
WebSocket Update Flow:
  1. Database update occurs (e.g., status change)
  2. Supabase Realtime detects change
  3. WebSocket broadcasts change to subscribers
  4. Frontend receives update
  5. Debounce check (500ms) to prevent spam
  6. Update React Query cache immediately (optimistic)
  7. Trigger background refetch (300ms delay)
  8. UI updates with optimistic data
  9. Full data replaces optimistic update when refetch completes
```

### 8.4 Security Implementation

#### 8.4.1 Row Level Security (RLS) Policies

**Consumer Orders:**
```sql
-- Policy: "Consumers can view their own orders"
USING: auth.uid() = user_id

-- Policy: "Consumers can insert their own orders"
WITH CHECK: auth.uid() = user_id
```

**Merchant Access:**
```sql
-- Policy: "Merchants can view orders for their shops"
USING: EXISTS (
  SELECT 1 FROM shops s
  JOIN merchant_accounts ma ON ma.id = s.merchant_id
  WHERE s.id = orders.shop_id
  AND ma.user_id = auth.uid()
)
```

**Public Read Policies:**
```sql
-- Policy: "Anyone can view open shops"
USING: is_open = true

-- Policy: "Anyone can view active items from open shops"
USING: is_active = true 
  AND EXISTS (
    SELECT 1 FROM shops s 
    WHERE s.id = merchant_items.shop_id 
    AND s.is_open = true
  )
```

#### 8.4.2 Authentication Flow

```
1. User signs up/signs in → Supabase Auth
2. JWT token generated and stored in localStorage
3. Token included in all API requests (Authorization header)
4. Supabase validates token on each request
5. RLS policies check auth.uid() for access control
6. Token refresh handled automatically
```

---

## 9. Challenges and Solutions

### 9.1 Challenge: RPC Timeout Issues

**Problem:** PostGIS RPC calls (`find_shops_by_location`) timing out, causing shop discovery to fail and users seeing no shops.

**Solution:**
- Added 20-second timeout directly to RPC call
- Implemented fallback method that returns all open shops (limit 30) without delivery area filtering
- Reduced shop limit to 30 for faster queries
- Overall timeout of 40 seconds with graceful degradation
- User-friendly error messages

**Result:** Users always see shops, even if PostGIS query is slow.

### 9.2 Challenge: Real-Time Update Reliability

**Problem:** WebSocket connections failing, causing UI to not update when order status changes.

**Solution:**
- Implemented exponential backoff for reconnections (1s, 2s, 4s, max 8s)
- Added polling fallback (3-second interval) if WebSocket fails
- Debounced updates (500ms) to prevent rapid-fire updates
- Unique channel names with timestamps to avoid binding conflicts
- Status confirmation polling for critical updates (30-second timeout)

**Result:** Reliable real-time updates with graceful fallback.

### 9.3 Challenge: Order Status Update Confirmation

**Problem:** Status update modal closing before status is confirmed in database, causing confusion.

**Solution:**
- Implemented `waitForStatusConfirmation()` function that polls database every 1 second
- Modal shows "Waiting for confirmation..." state
- 30-second timeout with graceful fallback
- Visual feedback during confirmation wait
- Modal only closes after confirmation or timeout

**Result:** Users see confirmed status updates before modal closes.

### 9.4 Challenge: Delivery Area Overlap Prevention

**Problem:** Merchants creating overlapping delivery areas, causing confusion in delivery fee calculation.

**Solution:**
- Database trigger `prevent_shop_delivery_area_overlap()` using PostGIS `ST_Intersects()`
- Validates geometry with `ST_IsValid()` before saving
- Returns user-friendly error messages
- Frontend validation before save (future enhancement)

**Result:** No overlapping delivery areas for the same shop.

### 9.5 Challenge: Cross-Browser Compatibility

**Problem:** Ensuring consistent behavior across different web browsers.

**Solution:**
- Used standard web APIs (no browser-specific code)
- Tailwind CSS with Autoprefixer for vendor prefixes
- React Query for consistent data fetching
- Tested on Chrome, Firefox, Safari, Edge

**Result:** Consistent experience across major browsers.

---

## 10. Testing and Quality Assurance

### 10.1 Testing Strategy

**Manual Testing:**
- Order placement and tracking flow
- Inventory management operations
- Delivery area creation and editing
- Real-time update verification
- Cross-browser testing
- Responsive design testing

**Error Handling:**
- Network timeout handling
- WebSocket reconnection logic
- Database constraint validation
- User-friendly error messages
- Graceful degradation

### 10.2 Performance Optimizations

**Frontend:**
- React Query caching and deduplication
- Debounced WebSocket updates (500ms)
- Optimistic UI updates
- Code splitting with Vite
- Lazy loading of components
- Image optimization

**Backend:**
- PostGIS spatial indexes (GIST) for fast queries
- Database query optimization
- RLS policy efficiency
- Connection pooling
- Indexed foreign keys

### 10.3 Responsive Design

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

**Features:**
- Mobile-first design approach
- Touch-friendly buttons and interactions
- Responsive navigation (sidebar on desktop, bottom nav on mobile)
- Adaptive layouts for different screen sizes

---

## 11. Deployment and Infrastructure

### 11.1 Supabase Configuration

**Database:**
- PostgreSQL 15+ with PostGIS extension
- Row Level Security enabled on all tables
- Database triggers for automation
- Migration system for version control
- GIST indexes on geometry columns

**Realtime:**
- WebSocket connections for real-time updates
- 30-second timeout for subscriptions
- Exponential backoff reconnection
- Event filtering by table and row

**Storage:**
- Shop images stored in `shop-images` bucket
- Item images stored in `item-images` bucket
- Public read access for consumer app
- RLS policies for merchant write access

**Authentication:**
- Email/password authentication
- JWT token-based authentication
- Automatic token refresh
- Session management

### 11.2 Environment Configuration

**Required Environment Variables:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

**Build Configuration:**
- Vite for fast development and optimized production builds
- TypeScript compilation
- Tailwind CSS processing
- Asset optimization

### 11.3 Deployment Process

**Development:**
```bash
npm run dev  # Start Vite dev server (http://localhost:3000)
```

**Production Build:**
```bash
npm run build  # Build for production
npm run preview  # Preview production build
```

**Deployment Options:**
- Vercel (recommended for React apps)
- Netlify
- GitHub Pages
- Any static hosting service

---

## 12. Future Enhancements

### 12.1 Planned Features

1. **Payment Integration:**
   - Online payment gateway (Stripe, PayPal)
   - Digital wallet system
   - Payment history and receipts

2. **Advanced Search:**
   - Full-text search for items
   - Search by barcode
   - Filter by price range, category

3. **Notifications:**
   - Browser push notifications
   - Email notifications for order updates
   - SMS alerts (optional)

4. **Reviews and Ratings:**
   - Shop ratings and reviews
   - Item ratings
   - Review moderation

5. **Loyalty Program:**
   - Points system
   - Discounts and coupons
   - Referral program

### 12.2 Technical Improvements

1. **Performance:**
   - Image lazy loading
   - Virtual scrolling for long lists
   - Service worker for offline support
   - Progressive Web App (PWA) features

2. **Scalability:**
   - Database query optimization
   - Caching strategies (Redis)
   - CDN for static assets
   - Load balancing

3. **Testing:**
   - Unit tests (Jest, Vitest)
   - Integration tests
   - E2E tests (Playwright, Cypress)
   - Visual regression tests

4. **Monitoring:**
   - Error tracking (Sentry)
   - Performance monitoring
   - Analytics (Google Analytics, Mixpanel)
   - Logging system

---

## 13. Conclusion

AroundYou is a comprehensive web-based local delivery platform that successfully addresses the needs of both consumers and merchants. The system provides real-time order tracking, location-based shop discovery, and comprehensive merchant management tools through a modern, responsive web application.

### 13.1 Key Achievements

- ✅ Full-stack web application with React.js and TypeScript
- ✅ Real-time order tracking with WebSocket subscriptions
- ✅ Location-based shop discovery with PostGIS
- ✅ Comprehensive inventory management with audit logging
- ✅ Delivery area management with polygon editing
- ✅ Multi-shop support for merchants
- ✅ Analytics dashboard for performance tracking
- ✅ Secure authentication and authorization (RLS)
- ✅ Responsive design for desktop and mobile browsers

### 13.2 Learning Outcomes

- Full-stack web development with modern technologies
- Real-time systems with WebSocket subscriptions
- Geospatial database queries with PostGIS
- Database design and optimization
- Security implementation with Row Level Security
- State management and caching strategies
- Responsive web design
- API design and integration

### 13.3 Project Impact

The platform successfully helps local shops digitize their operations and enables consumers to discover and order from nearby shops with real-time tracking. The system is scalable and can support multiple shops and users simultaneously.

---

## 14. References and Documentation

### 14.1 Key Documentation Files

- `PROJECT_STRUCTURE.md`: Project organization and structure
- `supabase/SCHEMA.md`: Complete database schema documentation
- `docs/inventory/`: Inventory system documentation
- `docs/delivery-areas-review.md`: Delivery area feature review
- `WEB_SETUP.md`: Web app setup and configuration guide

### 14.2 Technology Documentation

- **Supabase**: https://supabase.com/docs
- **PostGIS**: https://postgis.net/documentation/
- **React Query**: https://tanstack.com/query/latest
- **React Router**: https://reactrouter.com/
- **Vite**: https://vitejs.dev/
- **Tailwind CSS**: https://tailwindcss.com/docs

### 14.3 Code Structure

**Main Entry Points:**
- `web/src/main.tsx`: Application entry point
- `web/src/App.tsx`: Main app component
- `web/src/navigation/WebNavigator.tsx`: Routing configuration

**Key Services:**
- `src/services/supabase.ts`: Supabase client configuration
- `src/services/consumer/orderService.ts`: Consumer order operations
- `src/services/merchant/orderService.ts`: Merchant order operations
- `src/services/consumer/shopService.ts`: Shop discovery and queries
- `src/services/merchant/inventoryService.ts`: Inventory management

**Key Hooks:**
- `src/hooks/consumer/useShopsByLocation.ts`: Shop discovery hook
- `src/hooks/consumer/useOrder.ts`: Order tracking hook
- `src/hooks/merchant/useShopOrders.ts`: Merchant orders hook
- `src/hooks/merchant/useInventoryItems.ts`: Inventory management hook

---

**End of Report**

---

*This report provides a comprehensive overview of the AroundYou web application, covering architecture, features, implementation details, and technical decisions. It serves as a complete reference for understanding the project's design and functionality.*

