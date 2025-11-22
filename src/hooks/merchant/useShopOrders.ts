import { useEffect, useState, useRef, useCallback } from 'react';
import { useQueryClient } from 'react-query';
import { supabase } from '../../services/supabase';

export interface ShopOrder {
  id: string;
  shop_id: string;
  status: string;
  total_amount: number;
  total_cents?: number;
  created_at: string;
  updated_at: string;
  placed_at?: string;
  [key: string]: any;
}

/**
 * WebSocket-first hook for real-time shop orders
 * No polling, no fallbacks - WebSocket is the primary mechanism
 */
export function useShopOrders(shopId: string | undefined, limit: number = 50) {
  const queryClient = useQueryClient();
  const queryKey = ['shop-orders', shopId, limit];
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  // Use refs to track mounted state and prevent updates after unmount
  const isMountedRef = useRef(true);
  const ordersRef = useRef<ShopOrder[]>([]);

  // Stable callback for updating orders
  const updateOrders = useCallback((updater: (prev: ShopOrder[]) => ShopOrder[]) => {
    if (!isMountedRef.current) return;
    setOrders((prev) => {
      const updated = updater(prev);
      ordersRef.current = updated;
      return updated;
    });
  }, []);

  useEffect(() => {
    if (!shopId) {
      setOrders([]);
      setIsLoading(false);
      ordersRef.current = [];
      return;
    }

    isMountedRef.current = true;
    console.log('🔌 Setting up WebSocket-first order subscription for shop:', shopId);
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let tokenRefreshSubscription: { unsubscribe: () => void } | null = null;

    // Initial fetch - one-time load
    const initialFetch = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('shop_id', shopId)
          .order('placed_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        
        if (isMountedRef.current) {
          const ordersData = data || [];
          setOrders(ordersData);
          ordersRef.current = ordersData;
          setIsLoading(false);
          console.log('✅ Initial orders loaded:', ordersData.length);
        }
      } catch (error) {
        console.error('❌ Error fetching initial orders:', error);
        if (isMountedRef.current) {
          setOrders([]);
          ordersRef.current = [];
          setIsLoading(false);
        }
      }
    };

    // Create WebSocket channel for real-time updates
    const createChannel = () => {
      // Remove existing channel
      if (currentChannel) {
        try {
          supabase.removeChannel(currentChannel);
        } catch (err) {
          console.warn('Warning: Could not remove existing channel:', err);
        }
        currentChannel = null;
      }

      const channelName = `shop-orders-realtime:${shopId}:${Date.now()}`;
      console.log(`🔌 Creating WebSocket channel: ${channelName}`);

      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*', // INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'orders',
            filter: `shop_id=eq.${shopId}`,
          },
          (payload: any) => {
            if (!isMountedRef.current) return;

            console.log('📡 WebSocket order update:', payload.eventType, payload.new?.id || payload.old?.id);

            // Update local state using stable callback
            updateOrders((prevOrders) => {
              if (payload.eventType === 'INSERT' && payload.new) {
                const newOrder = payload.new as ShopOrder;
                // Check if order already exists (avoid duplicates)
                if (prevOrders.some(o => o.id === newOrder.id)) {
                  return prevOrders;
                }
                // Add to beginning (most recent first)
                return [newOrder, ...prevOrders].slice(0, limit);
              }

              if (payload.eventType === 'UPDATE' && payload.new) {
                const updatedOrder = payload.new as ShopOrder;
                return prevOrders.map((o) =>
                  o.id === updatedOrder.id ? updatedOrder : o
                );
              }

              if (payload.eventType === 'DELETE' && payload.old) {
                const deletedId = payload.old.id;
                return prevOrders.filter((o) => o.id !== deletedId);
              }

              return prevOrders;
            });

            // Also update React Query cache for consistency
            queryClient.setQueryData(queryKey, (prev: any) => {
              if (!prev) return prev;

              if (payload.eventType === 'INSERT' && payload.new) {
                const newOrder = payload.new as ShopOrder;
                if (prev.some((o: any) => o.id === newOrder.id)) {
                  return prev;
                }
                return [newOrder, ...prev].slice(0, limit);
              }

              if (payload.eventType === 'UPDATE' && payload.new) {
                const updatedOrder = payload.new as ShopOrder;
                return prev.map((o: any) =>
                  o.id === updatedOrder.id ? updatedOrder : o
                );
              }

              if (payload.eventType === 'DELETE' && payload.old) {
                const deletedId = payload.old.id;
                return prev.filter((o: any) => o.id !== deletedId);
              }

              return prev;
            });
          }
        )
        .subscribe((status, err) => {
          if (!isMountedRef.current) return;

          if (err) {
            const errorMessage = err.message || String(err);
            const isTokenExpired = errorMessage.includes('InvalidJWTToken') || errorMessage.includes('Token has expired');

            if (isTokenExpired) {
              console.log('🔄 Token expired, waiting for refresh...');
              if (isMountedRef.current) {
                setIsConnected(false);
              }
              return;
            }

            console.error('❌ WebSocket subscription error:', err);
            if (isMountedRef.current) {
              setIsConnected(false);
            }
          } else {
            console.log('📡 WebSocket status:', status);
            if (isMountedRef.current) {
              setIsConnected(status === 'SUBSCRIBED');
            }

            if (status === 'SUBSCRIBED') {
              console.log('✅ WebSocket connected for shop orders');
            }
          }
        });

      currentChannel = channel;
      return channel;
    };

    // Token refresh listener
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'TOKEN_REFRESHED' && session && isMountedRef.current) {
          console.log('🔄 Token refreshed, reconnecting WebSocket...');
          setTimeout(() => {
            if (isMountedRef.current) {
              createChannel();
            }
          }, 200);
        }
      });
      tokenRefreshSubscription = subscription;
    } catch (err) {
      console.warn('Warning: Could not set up token refresh listener:', err);
    }

    // Initial fetch and channel setup
    initialFetch();
    setTimeout(() => {
      if (isMountedRef.current) {
        createChannel();
      }
    }, 100);

    return () => {
      isMountedRef.current = false;
      console.log('🔌 Cleaning up WebSocket subscription for shop:', shopId);
      
      if (tokenRefreshSubscription) {
        try {
          tokenRefreshSubscription.unsubscribe();
        } catch (error) {
          console.warn('Error unsubscribing from token refresh:', error);
        }
      }

      if (currentChannel) {
        try {
          supabase.removeChannel(currentChannel);
        } catch (error) {
          console.warn('Error removing WebSocket channel:', error);
        }
      }
    };
  }, [shopId, limit, queryClient, queryKey, updateOrders]);

  return {
    data: orders,
    isLoading,
    isConnected,
  };
}
