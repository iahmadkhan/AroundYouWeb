/**
 * Order Service
 * 
 * Handles all order-related operations including placing orders,
 * tracking status, and managing order lifecycle.
 */

import { supabase } from '../supabase';
import {
  Order,
  OrderWithItems,
  OrderWithAll,
  PlaceOrderRequest,
  PlaceOrderResponse,
  OrderItem,
  DeliveryAddress,
  OrderCalculation,
} from '../../types/orders';

type MerchantItemRow = {
  id: string;
  price_cents: number;
};

type DeliveryLogicRow = {
  distance_tiers: Array<{ max_distance: number; fee: number }>;
  free_delivery_threshold: number;
  free_delivery_radius: number;
  beyond_tier_distance_unit: number;
  beyond_tier_fee_per_unit: number;
  max_delivery_fee: number;
  minimum_order_value: number;
  small_order_surcharge: number;
  least_order_value?: number;
};

type AddressRow = {
  id: string;
  title?: string | null;
  street_address: string;
  city: string;
  region: string | null;
  latitude: number;
  longitude: number;
  landmark: string | null;
  formatted_address: string | null;
};

type ShopLocationRow = {
  latitude: number;
  longitude: number;
};

// ============================================================================
// PLACE ORDER
// ============================================================================

/**
 * Calculate order totals including delivery fee and surcharge
 */
export async function calculateOrderTotals(
  shopId: string,
  items: Array<{ merchant_item_id: string; quantity: number }>,
  addressId: string
): Promise<OrderCalculation> {
  try {
    // Get item prices
    const itemIds = items.map((item) => item.merchant_item_id);
    const { data: merchantItemsRaw, error: itemsError } = await supabase
      .from('merchant_items')
      .select('id, price_cents')
      .in('id', itemIds);

    if (itemsError) throw itemsError;
    const merchantItems = (merchantItemsRaw ?? []) as MerchantItemRow[];

    // Calculate subtotal
    let subtotal_cents = 0;
    items.forEach((item) => {
      const merchantItem = merchantItems?.find((mi) => mi.id === item.merchant_item_id);
      if (merchantItem) {
        subtotal_cents += merchantItem.price_cents * item.quantity;
      }
    });

    // Get delivery logic
    const { data: deliveryLogicRaw, error: logicError } = await supabase
      .from('shop_delivery_logic')
      .select('*')
      .eq('shop_id', shopId)
      .single();

    if (logicError) throw logicError;
    if (!deliveryLogicRaw) throw new Error('Delivery logic not found');
    const deliveryLogic = deliveryLogicRaw as unknown as DeliveryLogicRow;

    // Get address for distance calculation
    const { data: addressRaw, error: addressError } = await supabase
      .from('consumer_addresses')
      .select('latitude, longitude')
      .eq('id', addressId)
      .single();

    if (addressError) throw addressError;
    if (!addressRaw) throw new Error('Address not found');
    const address = addressRaw as unknown as Pick<AddressRow, 'latitude' | 'longitude'>;

    // Get shop location
    const { data: shopRaw, error: shopError } = await supabase
      .from('shops')
      .select('latitude, longitude')
      .eq('id', shopId)
      .single();

    if (shopError) throw shopError;
    if (!shopRaw) throw new Error('Shop not found');
    const shop = shopRaw as unknown as ShopLocationRow;

    // Calculate distance using Haversine formula
    const distance_meters = calculateDistance(
      address.latitude,
      address.longitude,
      shop.latitude,
      shop.longitude
    );

    // Calculate delivery fee based on distance tiers
    let delivery_fee_cents = 0;
    const tiers = deliveryLogic.distance_tiers as Array<{
      max_distance: number;
      fee: number;
    }>;

    // Check if within free delivery radius
    if (
      subtotal_cents >= deliveryLogic.free_delivery_threshold * 100 &&
      distance_meters <= deliveryLogic.free_delivery_radius
    ) {
      delivery_fee_cents = 0;
    } else {
      // Find appropriate tier
      let tierFound = false;
      for (const tier of tiers) {
        if (distance_meters <= tier.max_distance) {
          delivery_fee_cents = tier.fee * 100; // Convert to cents
          tierFound = true;
          break;
        }
      }

      // If beyond all tiers, calculate using beyond_tier formula
      if (!tierFound) {
        const lastTier = tiers[tiers.length - 1];
        const excessDistance = distance_meters - lastTier.max_distance;
        const excessUnits = Math.ceil(
          excessDistance / deliveryLogic.beyond_tier_distance_unit
        );
        delivery_fee_cents =
          lastTier.fee * 100 +
          excessUnits * deliveryLogic.beyond_tier_fee_per_unit * 100;
      }

      // Cap at max delivery fee
      delivery_fee_cents = Math.min(
        delivery_fee_cents,
        deliveryLogic.max_delivery_fee * 100
      );
    }

    // Calculate surcharge for small orders
    let surcharge_cents = 0;
    if (subtotal_cents < deliveryLogic.minimum_order_value * 100) {
      surcharge_cents = deliveryLogic.small_order_surcharge * 100;
    }

    const total_cents = subtotal_cents + delivery_fee_cents + surcharge_cents;

    return {
      subtotal_cents,
      delivery_fee_cents,
      surcharge_cents,
      total_cents,
      distance_meters,
    };
  } catch (error) {
    console.error('Error calculating order totals:', error);
    throw error;
  }
}

/**
 * Haversine formula to calculate distance between two coordinates
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Place a new order
 */
export async function placeOrder(
  request: PlaceOrderRequest
): Promise<PlaceOrderResponse> {
  try {
    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('User not authenticated');

    // Get user profile
    const { data: profileRaw, error: profileError } = await supabase
      .from('user_profiles')
      .select('name, email')
      .eq('id', user.id)
      .single();

    if (profileError) throw profileError;
    const profile = (profileRaw ?? null) as { name?: string | null; email?: string | null } | null;

    // Get address details for snapshot
    // Use .maybeSingle() instead of .single() to handle cases where address doesn't exist
    // Also verify the address belongs to the current user (RLS should handle this, but we check explicitly)
    const { data: addressRaw, error: addressError } = await supabase
      .from('consumer_addresses')
      .select('*')
      .eq('id', request.consumer_address_id)
      .eq('user_id', user.id) // Ensure address belongs to current user
      .maybeSingle();

    if (addressError) {
      console.error('Error fetching address:', {
        code: addressError.code,
        message: addressError.message,
        details: addressError.details,
        hint: addressError.hint,
        addressId: request.consumer_address_id,
        userId: user.id,
      });
      throw new Error(`Failed to fetch address: ${addressError.message}`);
    }
    
    if (!addressRaw) {
      console.error('Address not found or access denied:', {
        addressId: request.consumer_address_id,
        userId: user.id,
        possibleReasons: [
          'Address does not exist',
          'Address belongs to a different user (RLS blocking)',
          'Address was deleted',
        ],
      });
      throw new Error(`Address not found or you don't have access to it. Please select a valid delivery address.`);
    }
    
    // Cast to AddressRow type
    // Note: We already filtered by user_id in the query, so this address belongs to the current user
    const address = addressRaw as unknown as AddressRow;

    // Calculate totals
    const calculation = await calculateOrderTotals(
      request.shop_id,
      request.items,
      request.consumer_address_id
    );

    // Check minimum order value
    // The order totals already include surcharge handling and distance checks.
    // Skip the legacy least_order_value guard that causes false warnings on web.

    // Get item details for snapshots
    const itemIds = request.items.map((item) => item.merchant_item_id);
    const { data: merchantItemsRaw, error: itemsError } = await supabase
      .from('merchant_items')
      .select('id, name, description, image_url, price_cents')
      .in('id', itemIds);

    if (itemsError) throw itemsError;
    const merchantItems = (merchantItemsRaw ?? []) as Array<{
      id: string;
      name?: string | null;
      description?: string | null;
      image_url?: string | null;
      price_cents: number;
    }>;

    // Create delivery address snapshot
    // Ensure all required fields are present and valid
    if (!address.street_address || !address.city) {
      throw new Error('Address is missing required fields (street_address or city)');
    }
    if (typeof address.latitude !== 'number' || typeof address.longitude !== 'number') {
      throw new Error('Address coordinates are invalid');
    }
    
    const deliveryAddressSnapshot: DeliveryAddress = {
      id: address.id,
      title: address.title ?? null,
      street_address: address.street_address,
      city: address.city,
      region: address.region ?? null,
      latitude: address.latitude,
      longitude: address.longitude,
      landmark: address.landmark ?? null,
      formatted_address: address.formatted_address ?? null,
    };

    // Create order
    const orderData = {
      shop_id: request.shop_id,
      user_id: user.id,
      consumer_address_id: request.consumer_address_id,
      status: 'pending',
      subtotal_cents: calculation.subtotal_cents,
      delivery_fee_cents: calculation.delivery_fee_cents,
      surcharge_cents: calculation.surcharge_cents,
      total_cents: calculation.total_cents,
      payment_method: request.payment_method,
      special_instructions: request.special_instructions,
      delivery_address: deliveryAddressSnapshot,
      customer_name: profile?.name ?? null,
      customer_email: profile?.email ?? null,
    };
    
    console.log('Placing order with data:', {
      ...orderData,
      delivery_address: deliveryAddressSnapshot, // Log separately for clarity
    });
    
    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .insert([orderData] as any)
      .select()
      .single();

    if (orderError) {
      console.error('Order insert error:', {
        code: orderError.code,
        message: orderError.message,
        details: orderError.details,
        hint: orderError.hint,
      });
      throw orderError;
    }
    if (!orderRow) throw new Error('Failed to create order');
    const insertedOrder = orderRow as Order;

    // Create order items
    const orderItemsToInsert = request.items.map((item) => {
      const merchantItem = merchantItems?.find(
        (mi) => mi.id === item.merchant_item_id
      );
      if (!merchantItem) throw new Error('Merchant item not found');

      return {
        order_id: insertedOrder.id,
        merchant_item_id: item.merchant_item_id,
        item_name: merchantItem.name || '',
        item_description: merchantItem.description,
        item_image_url: merchantItem.image_url,
        item_price_cents: merchantItem.price_cents,
        quantity: item.quantity,
        subtotal_cents: merchantItem.price_cents * item.quantity,
      };
    });

    console.log('Inserting order items:', orderItemsToInsert);
    
    const { data: orderItemsRaw, error: itemsInsertError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert as any)
      .select();

    if (itemsInsertError) {
      console.error('Order items insert error:', {
        code: itemsInsertError.code,
        message: itemsInsertError.message,
        details: itemsInsertError.details,
        hint: itemsInsertError.hint,
      });
      throw itemsInsertError;
    }
    const orderItems = (orderItemsRaw ?? []) as OrderItem[];

    return {
      success: true,
      order: {
        ...insertedOrder,
        order_items: orderItems,
      } as OrderWithItems,
    };
  } catch (error) {
    // Log detailed error information
    console.error('Error placing order:', error);
    
    // Extract more details from Supabase errors
    let errorMessage = 'Failed to place order';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object') {
      // Handle Supabase PostgrestError
      const supabaseError = error as any;
      if (supabaseError.message) {
        errorMessage = supabaseError.message;
      } else if (supabaseError.error) {
        errorMessage = supabaseError.error;
      } else if (supabaseError.details) {
        errorMessage = supabaseError.details;
      }
      
      // Log additional error details
      console.error('Error details:', {
        code: supabaseError.code,
        message: supabaseError.message,
        details: supabaseError.details,
        hint: supabaseError.hint,
        status: supabaseError.status,
        statusText: supabaseError.statusText,
      });
    }
    
    return {
      success: false,
      message: errorMessage,
      order: null as any,
    };
  }
}

// ============================================================================
// CANCEL ORDER (CONSUMER)
// ============================================================================

/**
 * Allow a consumer to cancel their own order.
 *
 * Notes:
 * - RLS ensures only the owner can update their order.
 * - Triggers in the database handle timestamps and validation of transitions.
 */
export async function cancelOrder(
  orderId: string,
  reason: string = 'Cancelled by customer'
): Promise<{ success: boolean; message?: string }> {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[cancelOrder] Auth error or no user', { authError });
      return { success: false, message: 'You must be logged in to cancel an order.' };
    }

    // Only update status; triggers will set cancelled_at and validate transition.
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
      })
      .eq('id', orderId);

    if (error) {
      console.error('[cancelOrder] Supabase error', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        orderId,
      });

      if (error.message?.includes('Invalid status transition')) {
        return {
          success: false,
          message: 'This order can no longer be cancelled.',
        };
      }

      if (error.message?.includes('Cannot change status from terminal state')) {
        return {
          success: false,
          message: 'This order is already completed or cancelled.',
        };
      }

      return {
        success: false,
        message: 'Failed to cancel order. Please try again.',
      };
    }

    return { success: true };
  } catch (err) {
    console.error('[cancelOrder] Unexpected error', err);
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Failed to cancel order. Please try again.',
    };
  }
}

// ============================================================================
// GET ORDERS
// ============================================================================

/**
 * Get all orders for the current user
 */
export async function getUserOrders(): Promise<OrderWithAll[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        order_items(*),
        shop:shops(id, name, image_url, shop_type, address, latitude, longitude),
        delivery_runner:delivery_runners(id, name, phone_number)
      `
      )
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false });

    if (error) throw error;

    return (data || []) as any;
  } catch (error) {
    console.error('Error getting user orders:', error);
    return [];
  }
}

/**
 * Get a single order by ID
 */
export async function getOrderById(orderId: string): Promise<OrderWithAll | null> {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        order_items(*),
        shop:shops(id, name, image_url, shop_type, address, latitude, longitude),
        delivery_runner:delivery_runners(id, name, phone_number)
      `
      )
      .eq('id', orderId)
      .single();

    if (error) throw error;

    return data as any;
  } catch (error) {
    console.error('Error getting order:', error);
    return null;
  }
}

/**
 * Get active order for current user (non-terminal status)
 */
export async function getActiveOrder(): Promise<OrderWithAll | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('orders')
      .select(
        `
        *,
        order_items(*),
        shop:shops(id, name, image_url, shop_type, address, latitude, longitude),
        delivery_runner:delivery_runners(id, name, phone_number)
      `
      )
      .eq('user_id', user.id)
      .not('status', 'in', '(delivered,cancelled)')
      .order('placed_at', { ascending: false })
      .limit(1)
      // maybeSingle() avoids 406/Not Acceptable when there is no active order
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return data as any;
  } catch (error) {
    console.error('Error getting active order:', error);
    return null;
  }
}

// ============================================================================
// REALTIME SUBSCRIPTION
// ============================================================================

/**
 * Subscribe to order updates via WebSocket (Supabase Realtime)
 * Uses WebSocket connection for real-time bidirectional communication
 */
export function subscribeToOrder(
  orderId: string,
  callback: (order: Order) => void
) {
  console.log('🔌 Setting up WebSocket subscription for order:', orderId);
  
  // Create a unique channel name for this order with timestamp to avoid conflicts
  // Using timestamp ensures each channel is unique and prevents binding mismatch errors
  const channelName = `order:${orderId}:${Date.now()}`;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let isCleanedUp = false;
  let currentChannel: ReturnType<typeof supabase.channel> | null = null;
  
  // Helper function to create a new channel (avoids binding mismatch on reconnect)
  const createChannel = () => {
    // Remove existing channel if any to avoid binding conflicts
    if (currentChannel) {
      try {
        // Only remove if channel is valid
        if (currentChannel.state) {
        supabase.removeChannel(currentChannel);
        }
      } catch (err: any) {
        // Suppress harmless errors when removing channel
        const errorMsg = err?.message || String(err);
        const isHarmlessError = 
          errorMsg.includes('WebSocket is closed') || 
          errorMsg.includes('closed before') ||
          errorMsg.includes('Cannot read properties of null') ||
          errorMsg.includes('unsubscribe');
        
        if (!isHarmlessError) {
        console.warn('Warning: Could not remove existing channel:', err);
        }
      }
      currentChannel = null;
    }
    
    // Create a new unique channel name each time to avoid binding mismatches
    const uniqueChannelName = `order:${orderId}:${Date.now()}`;
    
    console.log(`🔌 Creating WebSocket channel: ${uniqueChannelName}`);
    
    // Create channel - don't add presence config as it can cause binding issues with postgres_changes
    const channel = supabase
      .channel(uniqueChannelName)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      (payload) => {
        console.log('📡 WebSocket UPDATE received for order:', orderId, 'New status:', payload.new?.status);
        if (payload.new) {
          // Reset reconnect attempts on successful update
          reconnectAttempts = 0;
          // Call callback with updated order data immediately
          callback(payload.new as Order);
        }
      }
    )
    .subscribe(async (status, err) => {
      if (isCleanedUp) return;
      
      if (err) {
        const errorMessage = err.message || String(err);
        const isTokenExpired = errorMessage.includes('InvalidJWTToken') || errorMessage.includes('Token has expired');
        
        if (isTokenExpired) {
          // Token expired - don't reconnect, wait for token refresh listener to handle it
          if (reconnectAttempts === 0) {
            console.log('🔄 Token expired for order subscription, waiting for token refresh...');
          }
          // Token refresh listener will automatically reconnect
          return;
        }
        
        // Log error but don't spam console - WebSocket errors are often transient
        if (reconnectAttempts === 0) {
          console.warn('⚠️ WebSocket subscription error for order:', orderId, err.message || err);
        }
        // Don't attempt reconnect on error if we've exceeded max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          // Exponential backoff: 1s, 2s, 4s, max 8s
          const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 8000);
          reconnectTimeout = setTimeout(() => {
            if (!isCleanedUp && reconnectAttempts <= maxReconnectAttempts) {
              console.log(`🔄 Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts} for order:`, orderId, `(after ${backoffDelay}ms)`);
              try {
                // Create a new channel instead of reusing the old one to avoid binding mismatch
                // Note: createChannel() already calls .subscribe(), so no need to call it again
                createChannel();
              } catch (reconnectErr) {
                console.error('❌ Reconnection failed:', reconnectErr);
              }
            }
          }, backoffDelay);
        } else {
          // After max attempts, silently fall back to polling (already configured in useOrder hook)
          if (reconnectAttempts === maxReconnectAttempts) {
            console.log('ℹ️ WebSocket reconnection exhausted, falling back to polling for order:', orderId);
          }
        }
      } else {
        console.log('📡 WebSocket subscription status for order:', orderId, status);
        
        switch (status) {
          case 'SUBSCRIBED':
            console.log('✅ Successfully connected to WebSocket for order updates:', orderId);
            // Reset reconnect attempts on successful subscription
            reconnectAttempts = 0;
            // Verify connection by checking channel state
            console.log('📡 Channel state:', channel.state);
            break;
          case 'CHANNEL_ERROR':
            // Log only on first attempt to avoid console spam
            if (reconnectAttempts === 0) {
              console.warn('⚠️ WebSocket channel error for order subscription:', orderId, '- Will attempt reconnection');
            }
            // Only reconnect if we haven't exceeded max attempts
            if (reconnectAttempts < maxReconnectAttempts && !isCleanedUp) {
              reconnectAttempts++;
              // Exponential backoff: 1s, 2s, 4s, max 8s
              const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 8000);
              reconnectTimeout = setTimeout(() => {
                if (!isCleanedUp && reconnectAttempts <= maxReconnectAttempts) {
                  console.log(`🔄 Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts} after channel error:`, orderId, `(after ${backoffDelay}ms)`);
                  try {
                    // Create a new channel instead of reusing the old one to avoid binding mismatch
                    // Note: createChannel() already calls .subscribe(), so no need to call it again
                    createChannel();
                  } catch (reconnectErr) {
                    console.error('❌ Reconnection failed:', reconnectErr);
                  }
                }
              }, backoffDelay);
            } else {
              // After max attempts, silently fall back to polling
              if (reconnectAttempts === maxReconnectAttempts) {
                console.log('ℹ️ WebSocket channel error - max reconnection attempts reached, falling back to polling for order:', orderId);
              }
            }
            break;
          case 'TIMED_OUT':
            console.warn('⏱️ WebSocket subscription timed out for order:', orderId);
            // Only reconnect if we haven't exceeded max attempts
            if (reconnectAttempts < maxReconnectAttempts && !isCleanedUp) {
              reconnectAttempts++;
              // Exponential backoff: 2s, 4s, 8s, max 10s (longer for timeouts)
              const backoffDelay = Math.min(2000 * Math.pow(2, reconnectAttempts - 1), 10000);
              reconnectTimeout = setTimeout(() => {
                if (!isCleanedUp && reconnectAttempts <= maxReconnectAttempts) {
                  console.log(`🔄 Attempting reconnect ${reconnectAttempts}/${maxReconnectAttempts} after timeout:`, orderId, `(after ${backoffDelay}ms)`);
                  try {
                    // Create a new channel instead of reusing the old one to avoid binding mismatch
                    // Note: createChannel() already calls .subscribe(), so no need to call it again
                    createChannel();
                  } catch (reconnectErr) {
                    console.error('❌ Reconnection after timeout failed:', reconnectErr);
                  }
                }
              }, backoffDelay);
            } else {
              console.warn('⚠️ Max reconnection attempts reached after timeout for order:', orderId);
              console.log('ℹ️ Falling back to polling (already configured in component)');
            }
            break;
          case 'CLOSED':
            console.log('🔒 WebSocket subscription closed for order:', orderId);
            // Don't auto-reconnect on CLOSED - component cleanup handles this
            // Only reconnect if it was an unexpected close (not from cleanup)
            break;
          default:
            console.log('📡 WebSocket status changed:', status);
        }
      }
    });
    
    currentChannel = channel;
    return channel;
  };
  
  // Listen for token refresh events to automatically reconnect WebSocket
  let tokenRefreshSubscription: { unsubscribe: () => void } | null = null;
  
  try {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session && !isCleanedUp) {
        console.log('🔄 Token refreshed, reconnecting WebSocket channel for order:', orderId);
        // Small delay to ensure token is fully propagated
        setTimeout(() => {
          if (!isCleanedUp) {
            // Remove old channel and create new one with fresh token
            if (currentChannel) {
              try {
                // Only remove if channel is valid
                if (currentChannel.state) {
                supabase.removeChannel(currentChannel);
                }
              } catch (err: any) {
                // Suppress harmless errors when removing channel during token refresh
                const errorMsg = err?.message || String(err);
                const isHarmlessError = 
                  errorMsg.includes('WebSocket is closed') || 
                  errorMsg.includes('closed before') ||
                  errorMsg.includes('Cannot read properties of null') ||
                  errorMsg.includes('unsubscribe');
                
                if (!isHarmlessError) {
                console.warn('Warning: Could not remove channel during token refresh:', err);
                }
              }
              currentChannel = null;
            }
            createChannel();
          }
        }, 500);
      }
    });
    tokenRefreshSubscription = subscription;
  } catch (err) {
    console.warn('Warning: Could not set up token refresh listener:', err);
  }

  // Create initial channel with a small delay to ensure Supabase client is ready
  // This prevents "WebSocket is closed before connection is established" errors
  setTimeout(() => {
    if (!isCleanedUp) {
      createChannel();
    }
  }, 100);

  // Return cleanup function
  return () => {
    isCleanedUp = true;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (tokenRefreshSubscription) {
      try {
        tokenRefreshSubscription.unsubscribe();
      } catch (err) {
        console.warn('Warning: Could not unsubscribe from token refresh:', err);
      }
    }
    console.log('🔌 Unsubscribing from WebSocket for order:', orderId);
    if (currentChannel) {
      try {
        // Capture channel reference before clearing
        const channelToRemove = currentChannel;
        currentChannel = null;
        
        // Unsubscribe first to gracefully close the connection
        try {
          const channelState = channelToRemove?.state;
          if (channelState && (channelState === 'joined' || channelState === 'joining')) {
            channelToRemove.unsubscribe();
          }
        } catch (unsubError: any) {
          // Channel might already be closed, ignore unsubscribe errors
          const errorMsg = unsubError?.message || String(unsubError);
          if (!errorMsg.includes('null') && !errorMsg.includes('undefined')) {
            console.warn('Warning: Could not unsubscribe channel:', unsubError);
          }
        }
        
        // Small delay before removing channel to allow graceful closure
        setTimeout(() => {
          try {
            // Only remove channel if it still exists and is valid
            if (channelToRemove && channelToRemove.state) {
              supabase.removeChannel(channelToRemove);
            }
          } catch (removeError: any) {
            // Suppress common harmless errors
            const errorMsg = removeError?.message || String(removeError);
            const isHarmlessError = 
              errorMsg.includes('WebSocket is closed') || 
              errorMsg.includes('closed before') ||
              errorMsg.includes('Cannot read properties of null') ||
              errorMsg.includes('unsubscribe');
            
            if (!isHarmlessError) {
              console.warn('Warning: Could not remove WebSocket channel:', removeError);
            }
          }
        }, 50);
      } catch (error: any) {
        // Suppress common harmless errors during cleanup
        const errorMsg = error?.message || String(error);
        const isHarmlessError = 
          errorMsg.includes('WebSocket is closed') || 
          errorMsg.includes('closed before') ||
          errorMsg.includes('Cannot read properties of null') ||
          errorMsg.includes('unsubscribe');
        
        if (!isHarmlessError) {
          console.warn('Warning: Error during WebSocket cleanup:', error);
        }
      }
    }
  };
}

/**
 * Subscribe to active orders for current user
 * Optimized: Filters by user_id in WebSocket subscription and updates immediately
 * Includes automatic token refresh handling
 */
export function subscribeToUserOrders(callback: (orders: Order[]) => void) {
  console.log('🔌 Setting up WebSocket subscription for user orders');
  
  let currentChannel: ReturnType<typeof supabase.channel> | null = null;
  let isCleanedUp = false;
  let tokenRefreshSubscription: { unsubscribe: () => void } | null = null;
  
  // Helper to create/recreate channel with fresh token
  const createChannel = () => {
    // Remove existing channel if any
    if (currentChannel) {
      try {
        // Only remove if channel is valid
        if (currentChannel.state) {
        supabase.removeChannel(currentChannel);
        }
      } catch (err: any) {
        // Suppress harmless errors when removing channel
        const errorMsg = err?.message || String(err);
        const isHarmlessError = 
          errorMsg.includes('WebSocket is closed') || 
          errorMsg.includes('closed before') ||
          errorMsg.includes('Cannot read properties of null') ||
          errorMsg.includes('unsubscribe');
        
        if (!isHarmlessError) {
        console.warn('Warning: Could not remove existing channel:', err);
        }
      }
      currentChannel = null;
    }
    
    const uniqueChannelName = `user-orders:${Date.now()}`;
    console.log(`🔌 Creating WebSocket channel: ${uniqueChannelName}`);
    
    const channel = supabase
      .channel(uniqueChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        async (payload) => {
          if (isCleanedUp) return;
          
          // Get current user to filter orders
          const { data: { user: currentUser } } = await supabase.auth.getUser();
          if (!currentUser) return;
          
          const updatedOrder = payload.new as any;
          const oldOrder = payload.old as any;
          
          // Only process if this order belongs to the current user
          const orderUserId = updatedOrder?.user_id || oldOrder?.user_id;
          if (orderUserId !== currentUser.id) {
            console.log('📡 WebSocket: Order update for different user, ignoring');
            return;
          }
          
          console.log('📡 WebSocket order update received for user orders:', payload.eventType, updatedOrder?.status || oldOrder?.status);
          
          // Refetch all user orders to get updated data
          const orders = await getUserOrders();
          callback(orders);
        }
      )
      .subscribe((status, err) => {
        if (isCleanedUp) return;
        
        if (err) {
          const errorMessage = err.message || String(err);
          const isTokenExpired = errorMessage.includes('InvalidJWTToken') || errorMessage.includes('Token has expired');
          
          if (isTokenExpired) {
            console.log('🔄 Token expired, waiting for token refresh...');
            // Token refresh listener will handle reconnection
          } else {
            console.error('❌ WebSocket subscription error for user orders:', err);
          }
        } else {
          console.log('📡 WebSocket subscription status for user orders:', status);
          if (status === 'SUBSCRIBED') {
            console.log('✅ Successfully subscribed to user orders WebSocket');
          }
        }
      });
    
    currentChannel = channel;
    return channel;
  };
  
  // Listen for token refresh events to automatically reconnect WebSocket
  try {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED' && session && !isCleanedUp) {
        console.log('🔄 Token refreshed, reconnecting WebSocket channel for user orders');
        // Small delay to ensure token is fully propagated
        setTimeout(() => {
          if (!isCleanedUp) {
            createChannel();
          }
        }, 500);
      }
    });
    tokenRefreshSubscription = subscription;
  } catch (err) {
    console.warn('Warning: Could not set up token refresh listener:', err);
  }
  
  // Create initial channel
  setTimeout(() => {
    if (!isCleanedUp) {
      createChannel();
    }
  }, 100);

  return () => {
    isCleanedUp = true;
    if (tokenRefreshSubscription) {
      try {
        tokenRefreshSubscription.unsubscribe();
      } catch (err) {
        console.warn('Warning: Could not unsubscribe from token refresh:', err);
      }
    }
    console.log('🔌 Unsubscribing from user orders WebSocket');
    if (currentChannel) {
      try {
        // Capture channel reference before clearing
        const channelToRemove = currentChannel;
        currentChannel = null;
        
        // Unsubscribe first to gracefully close the connection
        try {
          const channelState = channelToRemove?.state;
          if (channelState && (channelState === 'joined' || channelState === 'joining')) {
            channelToRemove.unsubscribe();
          }
        } catch (unsubError: any) {
          // Channel might already be closed, ignore unsubscribe errors
          const errorMsg = unsubError?.message || String(unsubError);
          if (!errorMsg.includes('null') && !errorMsg.includes('undefined')) {
            console.warn('Warning: Could not unsubscribe channel:', unsubError);
          }
        }
        
        // Small delay before removing channel to allow graceful closure
        setTimeout(() => {
          try {
            // Only remove channel if it still exists and is valid
            if (channelToRemove && channelToRemove.state) {
              supabase.removeChannel(channelToRemove);
            }
          } catch (removeError: any) {
            // Suppress common harmless errors
            const errorMsg = removeError?.message || String(removeError);
            const isHarmlessError = 
              errorMsg.includes('WebSocket is closed') || 
              errorMsg.includes('closed before') ||
              errorMsg.includes('Cannot read properties of null') ||
              errorMsg.includes('unsubscribe');
            
            if (!isHarmlessError) {
              console.warn('Warning: Could not remove WebSocket channel:', removeError);
            }
          }
        }, 50);
      } catch (error: any) {
        // Suppress common harmless errors during cleanup
        const errorMsg = error?.message || String(error);
        const isHarmlessError = 
          errorMsg.includes('WebSocket is closed') || 
          errorMsg.includes('closed before') ||
          errorMsg.includes('Cannot read properties of null') ||
          errorMsg.includes('unsubscribe');
        
        if (!isHarmlessError) {
          console.warn('Warning: Error during WebSocket cleanup:', error);
        }
      }
    }
  };
}

