import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { getOrderById, subscribeToOrder } from '../../services/consumer/orderService';
import type { OrderWithAll } from '../../types/orders';

// Query keys for orders
export const orderKeys = {
  all: ['orders'] as const,
  detail: (orderId: string | undefined) => ['orders', 'detail', orderId] as const,
  list: () => ['orders', 'list'] as const,
};

/**
 * Hook to fetch and subscribe to a single order with real-time updates
 * 
 * This hook:
 * 1. Fetches the order using React Query
 * 2. Sets up a Supabase Realtime subscription for live updates
 * 3. Updates React Query cache when updates arrive
 * 4. Automatically triggers re-renders when the cache updates
 * 
 * @param orderId - The ID of the order to fetch and subscribe to
 * @returns React Query result with order data, loading state, and error
 */
export function useOrder(orderId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch order using React Query
  const query = useQuery<OrderWithAll | null>(
    orderKeys.detail(orderId),
    () => {
      if (!orderId) return Promise.resolve(null);
      return getOrderById(orderId);
    },
    {
      enabled: !!orderId,
      staleTime: 0, // Always fetch fresh data
    }
  );

  // Store refetch function in ref to avoid dependency issues
  const refetchRef = useRef(query.refetch);
  refetchRef.current = query.refetch;

  // Subscribe to real-time updates + lightweight polling/visibility fallback
  useEffect(() => {
    if (!orderId) return;

    // Realtime subscription: push updates IMMEDIATELY when Supabase sends them
    // No debouncing, no polling - WebSocket is primary mechanism
    const unsubscribeRealtime = subscribeToOrder(orderId, (updatedOrder) => {
      console.log('⚡ useOrder: WebSocket update received, updating cache IMMEDIATELY');
      
      // Update cache IMMEDIATELY - no delays, no debouncing, no requestAnimationFrame
      (queryClient as any).setQueryData(orderKeys.detail(orderId), (old: OrderWithAll | null) => {
        if (!old) {
          return updatedOrder as OrderWithAll;
        }
        
        // Merge updates with existing data to preserve relations
        return {
          ...old,
          ...updatedOrder,
          shop: (updatedOrder as any).shop || old.shop,
          order_items: (updatedOrder as any).order_items || old.order_items,
          delivery_address: (updatedOrder as any).delivery_address || old.delivery_address,
          delivery_runner: (updatedOrder as any).delivery_runner || old.delivery_runner,
        } as OrderWithAll;
      });
    });

    return () => {
      if (unsubscribeRealtime) {
        unsubscribeRealtime();
      }
    };
  }, [orderId, queryClient]); // Removed query from dependencies to prevent infinite loops

  return query;
}

