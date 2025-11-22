# Fix Consumer Side WebSocket Updates

## Issues Found:
1. `invalidationTimeout` error - likely from cached code (should be cleared)
2. Consumer side not receiving updates - `subscribeToUserOrders` refetches all orders instead of updating cache directly
3. Cache not persisting on reload - need to ensure WebSocket updates cache properly

## Fixes Applied:

### 1. Fixed `subscribeToUserOrders` to filter by user_id
- Now checks if order belongs to current user before processing
- Still refetches all orders (needed for full data with relations)
- Added better logging

### 2. Consumer side has TWO subscriptions:
- `useOrder` hook: Subscribes to single order via `subscribeToOrder` - updates cache directly ✅
- `OrderApprovalContext`: Subscribes to all user orders via `subscribeToUserOrders` - refetches all orders

### 3. The issue might be:
- WebSocket subscription not receiving updates (check console logs)
- Cache not being updated properly
- Database update not completing before modal closes

## Next Steps to Debug:
1. Check browser console for WebSocket subscription logs
2. Verify WebSocket is receiving UPDATE events
3. Check if cache is being updated in `useOrder` hook
4. Clear browser cache to fix `invalidationTimeout` error

