import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUserLocation } from '../../../src/hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../../src/context/LocationContext';
import { useCart } from '../../../src/context/CartContext';
import { useLocationStore } from '../../../src/stores/locationStore';
import {
  fetchDeliveryLogic,
  calculateTotalDeliveryFee,
  calculateDistance,
} from '../../../src/services/merchant/deliveryLogicService';
import type { DeliveryLogic } from '../../../src/services/merchant/deliveryLogicService';
import { placeOrder, getOrderById } from '../../../src/services/consumer/orderService';
import type { OrderWithAll } from '../../../src/types/orders';
import { createAddress, verifyAddress } from '../../../src/services/consumer/addressService';
import { supabase } from '../../../src/services/supabase';
import ConfirmationDialog from '../components/ConfirmationDialog';
import WebMap from '../components/WebMap';
import { loogin } from '../../../src/lib/loogin';
import { useAuth } from '../../../src/context/AuthContext';
import { useOrderApproval } from '../context/OrderApprovalContext';
import OrderApprovalModal from '../components/OrderApprovalModal';

const log = loogin.scope('web/checkout-screen');

interface ShopFees {
  shopId: string;
  deliveryLogic: DeliveryLogic | null;
  subtotal: number;
  smallOrderSurcharge: number;
  baseDeliveryFee: number;
  totalDeliveryFee: number;
  distanceInMeters?: number;
  freeDeliveryApplied: boolean;
}

export default function CheckoutScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { placeLabel, coords } = useUserLocation();
  const { selectedAddress, setSelectedAddress } = useLocationSelection();
  const confirmedLocation = useLocationStore((state) => state.confirmedLocation);
  const { user } = useAuth();
  const { activeOrder, setActiveOrder, showModal, setShowModal } = useOrderApproval();
  const {
    getAllItems,
    getShopIds,
    getShopCart,
    getTotalPrice,
    clearCart,
  } = useCart();

  const CHECKOUT_STORAGE_KEY = 'aroundyou_checkout_state';

  // Initialize state from localStorage
  const [shopFeesMap, setShopFeesMap] = useState<Record<string, ShopFees>>({});
  const [loadingFees, setLoadingFees] = useState(true);
  const [activeShopId, setActiveShopId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        return state.activeShopId || null;
      }
    } catch (error) {
      console.error('Error loading checkout state from localStorage:', error);
    }
    return null;
  });
  const [showClearShopConfirm, setShowClearShopConfirm] = useState(false);
  const [clearShopId, setClearShopId] = useState<string | null>(null);
  const [clearShopName, setClearShopName] = useState<string>('');
  const [showEmptyCartConfirm, setShowEmptyCartConfirm] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cod' | 'card' | 'wallet'>(() => {
    if (typeof window === 'undefined') return 'cod';
    try {
      const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        return state.selectedPaymentMethod || 'cod';
      }
    } catch (error) {
      console.error('Error loading checkout state from localStorage:', error);
    }
    return 'cod';
  });
  const [outOfZoneShopIds, setOutOfZoneShopIds] = useState<Set<string>>(new Set<string>());
  const [placingOrder, setPlacingOrder] = useState(false);
  const [placeOrderError, setPlaceOrderError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<{
    orderId: string;
    orderNumber?: string | null;
    totalCents: number;
    shopName: string;
  } | null>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [saveAddressError, setSaveAddressError] = useState<string | null>(null);
  const [saveAddressMessage, setSaveAddressMessage] = useState<string | null>(null);
  const [deliveryInstructions, setDeliveryInstructions] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const stored = localStorage.getItem(CHECKOUT_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        return state.deliveryInstructions || '';
      }
    } catch (error) {
      console.error('Error loading checkout state from localStorage:', error);
    }
    return '';
  });

  const allItems = getAllItems();
  const shopIds = getShopIds();

  // Memoize shopIdsWithItems to prevent infinite loops
  // Use a stable reference by stringifying the IDs array
  const shopIdsWithItems = useMemo(() => {
    const ids = shopIds.filter((id) => {
      const cart = getShopCart(id);
      return cart && cart.items.length > 0;
    });
    return ids;
    // Only depend on shopIds and getShopCart - don't depend on allItems as it changes references
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopIds.join(','), getShopCart]);

  // Persist checkout state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const state = {
        activeShopId,
        selectedPaymentMethod,
        deliveryInstructions,
      };
      localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Error saving checkout state to localStorage:', error);
    }
  }, [activeShopId, selectedPaymentMethod, deliveryInstructions]);

  useEffect(() => {
    const state = location.state as { checkoutShopId?: string } | undefined;
    if (state?.checkoutShopId) {
      setActiveShopId(state.checkoutShopId);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  // Validate and restore activeShopId from localStorage or set default
  useEffect(() => {
    if (shopIdsWithItems.length === 0) {
      // No items in cart, clear activeShopId
      if (activeShopId) {
        setActiveShopId(null);
      }
      return;
    }

    // If no activeShopId, set to first shop with items
    if (!activeShopId) {
      setActiveShopId(shopIdsWithItems[0]);
      return;
    }

    // If activeShopId is set but shop no longer has items, switch to first available shop
    if (!shopIdsWithItems.includes(activeShopId)) {
      setActiveShopId(shopIdsWithItems[0]);
    }
  }, [activeShopId, shopIdsWithItems]);

  useEffect(() => {
    setPlaceOrderError(null);
  }, [activeShopId]);

  useEffect(() => {
    setPlaceOrderError(null);
  }, [selectedAddress?.addressId, selectedPaymentMethod]);

  useEffect(() => {
    if (saveAddressMessage) {
      const timer = setTimeout(() => setSaveAddressMessage(null), 4000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [saveAddressMessage]);

  useEffect(() => {
    if (selectedAddress?.addressId || confirmedLocation?.addressId) {
      setSaveAddressError(null);
    }
  }, [selectedAddress?.addressId, confirmedLocation?.addressId]);

  useEffect(() => {
    let isCancelled = false;

    const fetchFees = async () => {
      if (shopIdsWithItems.length === 0) {
        if (!isCancelled) {
          setShopFeesMap({});
          setOutOfZoneShopIds(new Set<string>());
          setLoadingFees(false);
        }
        return;
      }

      const userCoords = selectedAddress?.coords || confirmedLocation?.coords || coords;

      if (!userCoords) {
        if (!isCancelled) {
          setShopFeesMap({});
          setOutOfZoneShopIds(new Set<string>());
          setLoadingFees(false);
        }
        return;
      }

      if (!isCancelled) {
        setLoadingFees(true);
      }

      const fees: Record<string, ShopFees> = {};
      const outOfZoneAccumulator = new Set<string>();

      try {
        await Promise.all(
          shopIdsWithItems.map(async (shopId) => {
            const shopCart = getShopCart(shopId);
            if (!shopCart) {
              return;
            }

            let shopLat: number | undefined;
            let shopLng: number | undefined;

            try {
              const { data: shopData, error: shopError } = await supabase
                .from('shops')
                .select('latitude, longitude')
                .eq('id', shopId)
                .single();

              if (shopError) {
                log.error('Failed to fetch shop coordinates', { shopId, shopError });
              }

              const typedShopData = shopData as { latitude?: number | null; longitude?: number | null } | null;

              if (typedShopData) {
                shopLat = typedShopData.latitude ?? undefined;
                shopLng = typedShopData.longitude ?? undefined;
              }
            } catch (error) {
              log.error('Unexpected error fetching shop coordinates', { shopId, error });
            }

            const { data: deliveryLogic, error: deliveryLogicError } = await fetchDeliveryLogic(shopId);

            if (deliveryLogicError) {
              log.error('Failed to fetch delivery logic', { shopId, deliveryLogicError });
            }

            const subtotal = getTotalPrice(shopId);
            const orderValue = subtotal / 100;

            let baseDeliveryFee = 0;
            let smallOrderSurcharge = 0;
            let totalDeliveryFee = 0;
            let distanceInMeters: number | undefined;
            let freeDeliveryApplied = false;

            const hasUserCoords =
              Boolean(userCoords) &&
              typeof userCoords?.latitude === 'number' &&
              typeof userCoords?.longitude === 'number';

            if (deliveryLogic && hasUserCoords && typeof shopLat === 'number' && typeof shopLng === 'number') {
              distanceInMeters = calculateDistance(
                userCoords.latitude,
                userCoords.longitude,
                shopLat,
                shopLng
              );

              const feeCalculation = calculateTotalDeliveryFee(
                orderValue,
                distanceInMeters,
                deliveryLogic
              );

              baseDeliveryFee = feeCalculation.baseFee * 100;
              smallOrderSurcharge = feeCalculation.surcharge * 100;
              totalDeliveryFee = feeCalculation.finalFee * 100;
              freeDeliveryApplied = feeCalculation.freeDeliveryApplied;

              if (feeCalculation.outOfZone) {
                outOfZoneAccumulator.add(shopId);
              }
            } else if (deliveryLogic) {
              if (orderValue < deliveryLogic.minimumOrderValue) {
                smallOrderSurcharge = deliveryLogic.smallOrderSurcharge * 100;
              }
              baseDeliveryFee = deliveryLogic.maxDeliveryFee * 100;
              totalDeliveryFee = baseDeliveryFee + smallOrderSurcharge;
            }

            fees[shopId] = {
              shopId,
              deliveryLogic: deliveryLogic || null,
              subtotal,
              smallOrderSurcharge,
              baseDeliveryFee,
              totalDeliveryFee,
              distanceInMeters,
              freeDeliveryApplied,
            };
          })
        );
      } catch (error) {
        if (!isCancelled) {
          log.error('Failed to calculate delivery fees', { error });
        }
      } finally {
        if (!isCancelled) {
          setShopFeesMap((prev) => {
            const next: Record<string, ShopFees> = {};
            shopIdsWithItems.forEach((id) => {
              if (fees[id]) {
                next[id] = fees[id];
              } else if (prev[id]) {
                next[id] = prev[id];
              }
            });
            return next;
          });
          setOutOfZoneShopIds(outOfZoneAccumulator);
          setLoadingFees(false);
        }
      }
    };

    fetchFees();

    return () => {
      isCancelled = true;
    };
    // Only depend on coords and shopIdsWithItems - getShopCart and getTotalPrice are stable functions from context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.latitude, coords?.longitude, selectedAddress?.coords?.latitude, selectedAddress?.coords?.longitude, confirmedLocation?.coords?.latitude, confirmedLocation?.coords?.longitude, shopIdsWithItems.join(',')]);

  const hasItems = allItems.length > 0;

  const renderEmptyState = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center px-3 sm:px-4 py-8 sm:py-12 md:py-16">
      <div className="bg-white/90 backdrop-blur rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full px-6 sm:px-8 md:px-10 py-8 sm:py-10 md:py-12 text-center space-y-4 sm:space-y-6 border border-blue-100">
        <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl sm:rounded-3xl bg-gradient-to-br from-blue-600 to-blue-900 text-white text-3xl sm:text-4xl flex items-center justify-center shadow-lg">
          🛒
        </div>
        <div className="space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Your cart is empty</h2>
          <p className="text-gray-600 text-xs sm:text-sm leading-relaxed px-2">
            Discover local shops near you and start adding items to build your order.
          </p>
        </div>
        <button
          onClick={() => navigate('/home')}
          className="px-6 sm:px-8 py-2.5 sm:py-3 md:py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base"
        >
          Browse shops
        </button>
      </div>
    </div>
  );

  const renderShopPicker = () => (
    <div className="bg-white/90 backdrop-blur rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full px-6 sm:px-8 md:px-10 py-8 sm:py-10 md:py-12 text-center space-y-4 sm:space-y-6 border border-blue-100">
      <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-blue-900 text-white text-2xl sm:text-3xl flex items-center justify-center shadow-lg">
        🛍️
      </div>
      <div className="space-y-2">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Choose a shop to continue</h2>
        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed px-2">
          You have items from multiple shops. Pick one to review its order, delivery charges, and complete the checkout.
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:gap-3 justify-center">
        {shopIdsWithItems.map((id) => {
          const cart = getShopCart(id);
          const count = cart?.items.length ?? 0;
          return (
            <button
              key={id}
              onClick={() => setActiveShopId(id)}
              className="px-3 sm:px-4 py-2 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs sm:text-sm font-semibold hover:-translate-y-1 hover:bg-blue-100 transition-all duration-200 shadow-sm"
            >
              <span className="block text-xs sm:text-sm font-semibold">{cart?.shopName || 'Shop'}</span>
              <span className="block text-[10px] sm:text-[11px] text-blue-500">{count} item{count !== 1 ? 's' : ''}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => navigate('/home')}
        className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
      >
        <span>Continue shopping</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );

  const renderActiveCheckout = () => {
    if (!activeShopId) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center px-4 py-16">
          {renderShopPicker()}
        </div>
      );
    }

    const shopCart = getShopCart(activeShopId);
    if (!shopCart || shopCart.items.length === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center px-4 py-16">
          {renderShopPicker()}
        </div>
      );
    }

    const shopFees = shopFeesMap[activeShopId];
    const shopSubtotal = getTotalPrice(activeShopId);
    const smallOrderAmount = shopFees?.smallOrderSurcharge || 0;
    const deliveryBaseAmount = shopFees?.baseDeliveryFee || 0;
    const deliveryAmount = shopFees?.freeDeliveryApplied ? 0 : deliveryBaseAmount;
    const shopTotal = shopSubtotal + (shopFees?.totalDeliveryFee || 0);
    const isAddressAvailable = Boolean(selectedAddress?.coords || confirmedLocation?.coords || coords);
    const hasShopFees = Boolean(shopFees);
    const showFeesSkeleton = loadingFees && isAddressAvailable && !shopFees;
    const showFeesUnavailable = !loadingFees && !isAddressAvailable;
    const isOutOfZone = activeShopId ? outOfZoneShopIds.has(activeShopId) : false;
    const disablePlaceOrderCore = showFeesSkeleton || !hasShopFees || isOutOfZone;
    const totalDisplayCents = isOutOfZone ? shopSubtotal : hasShopFees ? shopTotal : shopSubtotal;

    const resolvedAddress = selectedAddress as
      | {
          formatted?: string;
          street_address?: string;
          streetLine?: string;
          city?: string;
          region?: string;
          country?: string;
        }
      | null
      | undefined;

    const addressSummary =
      resolvedAddress?.formatted ||
      resolvedAddress?.street_address ||
      resolvedAddress?.streetLine ||
      confirmedLocation?.streetLine ||
      confirmedLocation?.address ||
      placeLabel ||
      'No delivery address selected';
    const addressSupplement =
      resolvedAddress?.city ||
      resolvedAddress?.region ||
      resolvedAddress?.country ||
      confirmedLocation?.city ||
      confirmedLocation?.region ||
      '';
    const hasAddress = Boolean(selectedAddress || confirmedLocation);
    const totalItemsCount = shopCart.items.reduce((sum, item) => sum + item.quantity, 0);
    const resolvedCoords = selectedAddress?.coords || confirmedLocation?.coords || coords;
    const isAddressSaved = Boolean(selectedAddress?.addressId || confirmedLocation?.addressId);

    const createAddressForCurrentLocation = async (withFeedback = false): Promise<string | null> => {
      if (!resolvedCoords || typeof resolvedCoords.latitude !== 'number' || typeof resolvedCoords.longitude !== 'number') {
        if (withFeedback) {
          setSaveAddressError('Select a delivery location before saving the address.');
        }
        return null;
      }

      if (!user) {
        if (withFeedback) {
          navigate('/login', {
            state: {
              returnTo: 'cart',
              returnState: { checkoutShopId: activeShopId },
            },
          });
        }
        return null;
      }

      const streetLine =
        resolvedAddress?.street_address ||
        resolvedAddress?.streetLine ||
        confirmedLocation?.streetLine ||
        resolvedAddress?.formatted ||
        placeLabel ||
        'Delivery address';

      const cityName = (resolvedAddress?.city || confirmedLocation?.city || '').trim() || 'Unknown';
      const regionName = (resolvedAddress?.region || confirmedLocation?.region || '') || undefined;
      const formattedAddress =
        resolvedAddress?.formatted || confirmedLocation?.address || placeLabel || streetLine;

      if (withFeedback) {
        setSavingAddress(true);
        setSaveAddressError(null);
        setSaveAddressMessage(null);
      }

      try {
        const response = await createAddress({
          street_address: streetLine,
          city: cityName,
          region: regionName ?? undefined,
          latitude: resolvedCoords.latitude,
          longitude: resolvedCoords.longitude,
          formatted_address: formattedAddress,
        });

        if (response.error || !response.data) {
          if (withFeedback) {
            setSaveAddressError(response.error?.message || 'Failed to save address.');
          }
          return null;
        }

        const saved = response.data;

        setSelectedAddress({
          label: saved.street_address || streetLine,
          city: saved.city || cityName,
          coords: resolvedCoords,
          isCurrent: false,
          addressId: saved.id || undefined,
        });

        if (withFeedback) {
          setSaveAddressMessage('Address saved to your profile.');
          setPlaceOrderError(null);
        } else {
          setSaveAddressError(null);
          setSaveAddressMessage(null);
        }

        return saved.id ?? null;
      } catch (error) {
        if (withFeedback) {
          setSaveAddressError(error instanceof Error ? error.message : 'Failed to save address.');
        }
        return null;
      } finally {
        if (withFeedback) {
          setSavingAddress(false);
        }
      }
    };

    const handleSaveAddressClick = async () => {
      await createAddressForCurrentLocation(true);
    };

    const paymentOptions = [
      {
        id: 'cod' as const,
        title: 'Cash on delivery',
        description: 'Pay with cash when your order arrives at the door.',
        icon: '💵',
      },
      {
        id: 'card' as const,
        title: 'Card payment',
        description: 'Secure checkout with your debit or credit card.',
        icon: '💳',
      },
      {
        id: 'wallet' as const,
        title: 'Mobile wallet',
        description: 'Use your preferred mobile wallet for instant payment.',
        icon: '📱',
      },
    ];

    const paymentMethodMap = {
      cod: 'cash',
      card: 'card',
      wallet: 'wallet',
    } as const;
    const paymentMethod = paymentMethodMap[selectedPaymentMethod];
    const shouldDisablePlaceOrder = placingOrder || disablePlaceOrderCore;
    const placeOrderButtonLabel = (() => {
      if (placingOrder) {
        return 'Placing order…';
      }
      if (isOutOfZone) {
        return 'Out of delivery zone';
      }
      if (showFeesSkeleton) {
        return 'Calculating…';
      }
      if (!hasShopFees) {
        return showFeesUnavailable ? 'Add address to proceed' : 'Loading fees…';
      }
      if (showFeesUnavailable) {
        return 'Add address to proceed';
      }
      return 'Place order';
    })();

    const ensureAddressId = async (): Promise<string | null> => {
      const existingId = selectedAddress?.addressId ?? confirmedLocation?.addressId ?? null;
      if (existingId) {
        // Verify the address actually exists and belongs to the current user
        const verification = await verifyAddress(existingId);
        if (verification.exists && !verification.error) {
          log.info('Using existing address', { addressId: existingId });
          return existingId;
        } else {
          // Address doesn't exist or user doesn't have access - log and create new one
          log.warn('Existing address not found or inaccessible', {
            addressId: existingId,
            error: verification.error?.message,
          });
        }
      }
      // No existing address or it doesn't exist - create a new one
      return await createAddressForCurrentLocation(false);
    };

    const handlePlaceOrderClick = async () => {
      if (!activeShopId) {
        return;
      }

      if (!user) {
        navigate('/login', {
          state: {
            returnTo: 'cart',
            returnState: { checkoutShopId: activeShopId },
          },
        });
        return;
      }

      const shopCartCurrent = getShopCart(activeShopId);
      const shopFeesForActive = shopFeesMap[activeShopId];

      if (!shopCartCurrent || shopCartCurrent.items.length === 0) {
        setPlaceOrderError('Your cart is empty for this shop.');
        return;
      }

      const ensuredAddressId = await ensureAddressId();
      if (!ensuredAddressId) {
        setPlaceOrderError('We could not save this delivery address. Please try again.');
        return;
      }

      if (!shopFeesForActive) {
        setPlaceOrderError('Delivery fees are still loading. Please wait a moment.');
        return;
      }

      if (isOutOfZone) {
        setPlaceOrderError(`This address is outside ${shopCartCurrent.shopName}'s delivery zone.`);
        return;
      }

      setPlacingOrder(true);
      setPlaceOrderError(null);

      log.info('Placing order', {
        shopId: activeShopId,
        paymentMethod,
        addressId: ensuredAddressId,
        items: shopCartCurrent.items.length,
      });

      try {
        const response = await placeOrder({
          shop_id: activeShopId,
          consumer_address_id: ensuredAddressId,
          items: shopCartCurrent.items.map((item) => ({
            merchant_item_id: item.id,
            quantity: item.quantity,
          })),
          payment_method: paymentMethod,
          special_instructions: deliveryInstructions.trim() || undefined,
        });

        if (!response.success || !response.order) {
          const message = response.message || 'Failed to place order. Please try again.';
          log.warn('Place order failed', { shopId: activeShopId, message });
          setPlaceOrderError(message);
          return;
        }

        log.info('Order placed successfully', {
          orderId: response.order.id,
          shopId: activeShopId,
        });

        // If there's already an active order in notifications, don't replace it
        // Instead, navigate to the order status screen for the new order
        if (activeOrder && activeOrder.status !== 'delivered' && activeOrder.status !== 'cancelled') {
          log.info('Active order already exists in notifications, navigating to new order status screen', {
            existingOrderId: activeOrder.id,
            newOrderId: response.order.id,
          });
          // Navigate to order status screen for the new order
          navigate(`/orderstatus?orderId=${response.order.id}`);
        } else {
          // No active order or it's in terminal state, set this as the active order
          if (response.order) {
            // Cast to OrderWithAll - we already have the order data from placeOrder
            const fullOrder = response.order as unknown as OrderWithAll;
            setActiveOrder(fullOrder);
            setShowModal(true);
            log.info('Order modal opened with placed order data');
          }
        }

        setOrderSuccess({
          orderId: response.order.id,
          orderNumber: response.order.order_number,
          totalCents: response.order.total_cents,
          shopName: shopCartCurrent.shopName,
        });

        // Calculate remaining shops before clearing cart
        const remainingShopIds = shopIdsWithItems.filter(id => id !== activeShopId);
        
        clearCart(activeShopId);
        
        // Clear checkout state from localStorage when order is placed
        // Only clear if this was the last shop in cart, otherwise keep state for other shops
        if (remainingShopIds.length === 0) {
          // Last shop, clear all checkout state
          try {
            localStorage.removeItem(CHECKOUT_STORAGE_KEY);
          } catch (error) {
            console.error('Error clearing checkout state from localStorage:', error);
          }
          setActiveShopId(null);
          setDeliveryInstructions('');
        } else {
          // Other shops still have items, switch to next shop
          setActiveShopId(remainingShopIds[0]);
        }
      } catch (error) {
        log.error('Unexpected error placing order', { error });
        setPlaceOrderError(
          error instanceof Error ? error.message : 'Failed to place order. Please try again.'
        );
      } finally {
        setPlacingOrder(false);
      }
    };

    const showMap = resolvedCoords && typeof resolvedCoords.latitude === 'number' && typeof resolvedCoords.longitude === 'number';

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 sm:py-8 md:py-12 space-y-5 sm:space-y-6 md:space-y-7">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-blue-500">
              Checkout
              <span className="block w-8 sm:w-10 h-px bg-blue-200" />
            </span>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">
              Review & confirm your order
            </h1>
            <p className="text-sm sm:text-base text-gray-600">
              You're checking out from{' '}
              <span className="font-semibold text-gray-900">{shopCart.shopName}</span>. Make sure the
              delivery details and order summary look good before placing an order.
            </p>
          </div>

          {shopIdsWithItems.length > 1 && (
            <div className="bg-white border border-gray-100 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Shops in your cart
                </span>
                <span className="text-[10px] sm:text-xs text-gray-400">
                  Pick a shop to view its delivery and billing details
                </span>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {shopIdsWithItems.map((id) => {
                  const cart = getShopCart(id);
                  const isActive = id === activeShopId;
                  const count = cart?.items.length ?? 0;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveShopId(id)}
                      className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-blue-600 to-blue-900 text-white shadow-lg'
                          : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400 hover:text-blue-600'
                      }`}
                    >
                      <span className="block truncate">{cart?.shopName || 'Shop'}</span>
                      <span className={`block text-[10px] sm:text-xs ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                        {count} item{count !== 1 ? 's' : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
              <section className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-gray-900">Delivery address</h2>
                    <p className="text-xs sm:text-sm text-gray-700 mt-2 whitespace-pre-line break-words">{addressSummary}</p>
                    {addressSupplement && <p className="text-xs text-gray-500 mt-1">{addressSupplement}</p>}
                    {!hasAddress && (
                      <p className="text-xs text-amber-600 mt-3">
                        Select or add a delivery address so we can guide the rider accurately.
                      </p>
                    )}
                    {hasAddress && !isAddressSaved && (
                      <p className="text-xs text-amber-600 mt-3">
                        Save this address to your profile before placing the order.
                      </p>
                    )}
                    {saveAddressError && (
                      <p className="text-xs text-red-600 mt-3">{saveAddressError}</p>
                    )}
                    {saveAddressMessage && (
                      <p className="text-xs text-green-600 mt-3">{saveAddressMessage}</p>
                    )}
                  </div>
                  <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                    <button
                      onClick={() => navigate('/consumeraddressmanagement')}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-blue-600 transition-colors hover:border-blue-300 hover:bg-blue-100 whitespace-nowrap"
                    >
                      {hasAddress ? 'Change address' : 'Add address'}
                    </button>
                    {hasAddress && !isAddressSaved && resolvedCoords && typeof resolvedCoords.latitude === 'number' && typeof resolvedCoords.longitude === 'number' && (
                      <button
                        onClick={handleSaveAddressClick}
                        disabled={savingAddress}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-600 transition-colors hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingAddress ? (
                          <span className="inline-flex items-center gap-2">
                            <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                            Saving…
                          </span>
                        ) : (
                          'Save address'
                        )}
                      </button>
                    )}
                  </div>
                </div>
                <div
                  className={`rounded-lg sm:rounded-xl border p-2 sm:p-3 ${
                    isOutOfZone ? 'border-red-300 bg-red-50/70' : 'border-gray-200 bg-gray-100/60'
                  }`}
                >
                  {showMap ? (
                    <div className="relative h-48 sm:h-56 w-full overflow-hidden rounded-lg sm:rounded-xl bg-white">
                      <WebMap
                        initialRegion={{
                          latitude: resolvedCoords.latitude,
                          longitude: resolvedCoords.longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }}
                        markers={[
                          {
                            latitude: resolvedCoords.latitude,
                            longitude: resolvedCoords.longitude,
                            icon: '📍',
                            title: 'Delivery location',
                          },
                        ]}
                        showDeliveryLabel={false}
                        showsUserLocation={false}
                        showShopMarker={false}
                        showGeolocationButton={false}
                        interactive={false}
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-transparent to-transparent px-4 py-3 text-white">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/70">Delivery</p>
                        <p className="text-sm font-semibold">{addressSummary}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-48 sm:h-56 flex-col items-center justify-center rounded-lg sm:rounded-xl bg-white text-center px-4">
                      <span className="text-3xl sm:text-4xl mb-2">📍</span>
                      <p className="text-xs sm:text-sm text-gray-600 max-w-xs">
                        Add a delivery address to preview its exact location on the map.
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Delivery Instructions / Contact Details */}
                <div className="mt-3 sm:mt-4 space-y-2">
                  <label htmlFor="delivery-instructions" className="block text-xs sm:text-sm font-semibold text-gray-900">
                    Delivery instructions / Contact details
                  </label>
                  <textarea
                    id="delivery-instructions"
                    value={deliveryInstructions}
                    onChange={(e) => setDeliveryInstructions(e.target.value)}
                    placeholder="e.g., Ring the doorbell twice, Leave at the gate, Call when you arrive, etc."
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-gray-900 border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder:text-gray-400 transition-all"
                  />
                  <p className="text-xs text-gray-500">
                    {deliveryInstructions.length}/500 characters
                  </p>
                </div>
              </section>

              <section className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Payment method</h2>
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.3em] text-blue-500">
                    Secure checkout
                  </span>
                </div>
                <div className="space-y-2 sm:space-y-3">
                  {paymentOptions.map((option) => {
                    const isSelected = selectedPaymentMethod === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setSelectedPaymentMethod(option.id)}
                        className={`w-full rounded-xl sm:rounded-2xl border px-3 sm:px-4 py-2.5 sm:py-3 text-left transition-all ${
                          isSelected
                            ? 'border-blue-400 bg-blue-50 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 sm:gap-3">
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <span className="text-lg sm:text-xl flex-shrink-0">{option.icon}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{option.title}</p>
                              <p className="text-[10px] sm:text-xs text-gray-500 line-clamp-2">{option.description}</p>
                            </div>
                          </div>
                          <span
                            className={`h-4 w-4 rounded-full border-2 ${
                              isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                            }`}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs text-blue-700">
                  Riders currently support cash payments and will soon accept card and wallet payments at the door.
                </div>
              </section>
            </div>

            <div className="space-y-4 sm:space-y-5 md:space-y-6">
              <section className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">Order summary</h2>
                  <span className="text-[10px] sm:text-xs text-gray-400 flex-shrink-0">
                    {totalItemsCount} item{totalItemsCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {isOutOfZone ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
                    {shopCart.shopName} can't deliver to this address. Choose a different delivery location within the service area.
                    {shopFees?.distanceInMeters != null && (
                      <span className="block mt-1 text-[11px] text-red-500">
                        Current location is {(shopFees.distanceInMeters / 1000).toFixed(2)} km away.
                      </span>
                    )}
                  </div>
                ) : null}

                <div className="rounded-xl sm:rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <div className="border-b border-gray-100 px-3 sm:px-4 md:px-5 py-3 sm:py-4">
                    <h3 className="text-xs sm:text-sm font-semibold text-gray-900 uppercase tracking-wide">Order Summary</h3>
                    <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-700 flex items-start justify-between gap-2">
                      <span className="flex-1 min-w-0 truncate">
                        {totalItemsCount} × {shopCart.items[0]?.name || 'Item'}
                      </span>
                      <span className="ml-2 sm:ml-3 font-semibold flex-shrink-0">Rs {(shopSubtotal / 100).toFixed(0)}</span>
                    </p>
                  </div>
                  <div className="px-3 sm:px-4 md:px-5 py-3 sm:py-4 space-y-2 text-xs sm:text-sm text-gray-700">
                    <div className="flex items-center justify-between">
                      <span>Subtotal</span>
                      <span className="font-semibold text-gray-900">Rs {(shopSubtotal / 100).toFixed(0)}</span>
                    </div>
                    {smallOrderAmount > 0 && (
                      <div className="flex items-center justify-between">
                        <span>Small order surcharge</span>
                        <span className="font-semibold text-gray-900">
                          Rs {(smallOrderAmount / 100).toFixed(0)}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span>Delivery</span>
                      <span className="font-semibold text-gray-900">
                        {isOutOfZone
                          ? '--'
                          : hasShopFees && shopFees
                          ? shopFees.freeDeliveryApplied
                            ? 'Free'
                            : `Rs ${(deliveryAmount / 100).toFixed(0)}`
                          : showFeesUnavailable
                          ? 'Add address'
                          : '...'}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-gray-200 px-3 sm:px-4 md:px-5 py-3 sm:py-4 flex items-center justify-between">
                    <span className="text-sm sm:text-base font-semibold text-gray-900">Total</span>
                    <span className="text-base sm:text-lg font-bold text-blue-600">
                      {isOutOfZone
                        ? '--'
                        : `Rs ${((hasShopFees ? shopTotal : shopSubtotal) / 100).toFixed(0)}`}
                    </span>
                  </div>
                </div>
                <p className="text-[10px] sm:text-[11px] text-gray-500 text-center px-2">
                  By placing this order you agree to all{' '}
                  <button
                    onClick={() => navigate('/terms')}
                    className="font-semibold text-gray-700 underline underline-offset-2 hover:text-blue-600"
                  >
                    terms &amp; conditions
                  </button>
                  .
                </p>
              </section>

              <section className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-base sm:text-lg font-bold text-gray-900">Total payable</span>
                  <span className="text-xl sm:text-2xl font-bold text-blue-600">
                    {isOutOfZone
                      ? '--'
                      : disablePlaceOrderCore && !hasShopFees
                      ? '...'
                      : `Rs. ${(totalDisplayCents / 100).toFixed(2)}`}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Includes delivery charges and any applicable surcharges.
                  {isOutOfZone ? (
                    <span className="block text-red-600 mt-2">
                      This address is outside {shopCart.shopName}'s delivery zone. Select another delivery location to continue.
                    </span>
                  ) : (
                    showFeesUnavailable && (
                    <span className="block text-amber-600 mt-2">
                      Add a delivery address to get precise delivery fees based on your location.
                    </span>
                    )
                  )}
                </p>
                {placeOrderError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">
                    {placeOrderError}
                  </div>
                )}
                <button
                  onClick={async () => {
                    if (!user) {
                      navigate('/login', {
                        state: {
                          returnTo: 'cart',
                          returnState: { checkoutShopId: activeShopId },
                        },
                      });
                      return;
                    }
                    await handlePlaceOrderClick();
                  }}
                  disabled={shouldDisablePlaceOrder}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-2.5 sm:py-3 md:py-3.5 rounded-xl font-semibold text-sm sm:text-base md:text-lg hover:from-blue-700 hover:to-blue-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {placingOrder ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-flex h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                      <span>Placing order…</span>
                    </span>
                  ) : (
                    placeOrderButtonLabel
                  )}
                </button>
                <button
                  onClick={() => navigate(`/shop/${activeShopId}`)}
                  className="w-full bg-gray-100 text-gray-700 py-2.5 sm:py-3 md:py-3.5 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-200 inline-flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  Continue shopping
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowEmptyCartConfirm(true)}
                  className="w-full text-xs sm:text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 py-2 sm:py-2.5 rounded-lg transition-colors"
                >
                  Empty entire cart
                </button>
              </section>
          </div>
        </div>
      </div>

      {/* Route to full-screen Order Status instead of modal */}
    </div>
  );
};

  // Redirect to full-screen order status the first time for a given order
  React.useEffect(() => {
    if (showModal && activeOrder?.id) {
      const seenKey = `aroundyou_orderstatus_seen_${activeOrder.id}`;
      const seen = typeof window !== 'undefined' ? localStorage.getItem(seenKey) : 'true';
      if (!seen) {
        try {
          localStorage.setItem(seenKey, 'true');
        } catch {}
        setShowModal(false);
        navigate(`/orderstatus?orderId=${activeOrder.id}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal, activeOrder?.id]);

  const mainContent = hasItems ? renderActiveCheckout() : renderEmptyState();

  return (
    <>
      {mainContent}
      {/* Order Approval Modal (used for subsequent opens) */}
      {showModal && activeOrder && (
        <OrderApprovalModal
          order={activeOrder}
          onClose={() => {
            setShowModal(false);
            if (activeOrder.status === 'delivered' || activeOrder.status === 'cancelled') {
              setActiveOrder(null);
            }
          }}
        />
      )}

      <ConfirmationDialog
        isOpen={showClearShopConfirm}
        title="Clear Shop Cart"
        message={`Are you sure you want to remove all items from ${clearShopName}? This action cannot be undone.`}
        confirmText="Clear Cart"
        cancelText="Cancel"
        variant="warning"
        onConfirm={() => {
          if (clearShopId) {
            clearCart(clearShopId);
          }
          setShowClearShopConfirm(false);
          setClearShopId(null);
          setClearShopName('');
        }}
        onCancel={() => {
          setShowClearShopConfirm(false);
          setClearShopId(null);
          setClearShopName('');
        }}
      />

      <ConfirmationDialog
        isOpen={showEmptyCartConfirm}
        title="Empty Entire Cart"
        message="Are you sure you want to remove all items from all shops? This action cannot be undone."
        confirmText="Empty Cart"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => {
          clearCart();
          setShowEmptyCartConfirm(false);
        }}
        onCancel={() => setShowEmptyCartConfirm(false)}
      />

      {orderSuccess && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm px-3 sm:px-4 py-4 sm:py-6">
          <div className="relative w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-6 sm:p-8 shadow-2xl">
            <button
              onClick={() => setOrderSuccess(null)}
              className="absolute right-3 top-3 sm:right-4 sm:top-4 rounded-full bg-gray-100 p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors"
              aria-label="Close success dialog"
            >
              <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mx-auto mb-4 sm:mb-6 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl bg-blue-50 text-2xl sm:text-3xl">
              🎉
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 text-center">Order placed!</h3>
            <p className="mt-2 text-xs sm:text-sm text-gray-600 text-center px-2">
              We&apos;ve received your order for <span className="font-semibold text-gray-900">{orderSuccess.shopName}</span>. We&apos;ll keep you posted as the shop confirms and prepares it.
            </p>
            <div className="mt-4 sm:mt-6 rounded-xl sm:rounded-2xl border border-blue-100 bg-blue-50/60 px-4 sm:px-5 py-3 sm:py-4 space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
                <span>Order reference</span>
                <span className="font-semibold text-gray-900">
                  #{(orderSuccess.orderNumber || orderSuccess.orderId.slice(0, 8)).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm text-gray-600">
                <span>Total paid</span>
                <span className="text-base sm:text-lg font-bold text-blue-600">
                  Rs {Math.round(orderSuccess.totalCents / 100).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="mt-4 sm:mt-6 space-y-2 sm:space-y-3">
              <button
                onClick={() => {
                  setOrderSuccess(null);
                  navigate('/orders');
                }}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 py-2.5 sm:py-3 md:py-3.5 text-xs sm:text-sm font-semibold text-white shadow-lg transition-all duration-200 hover:from-blue-700 hover:to-blue-600"
              >
                View my orders
              </button>
              <button
                onClick={() => {
                  setOrderSuccess(null);
                  navigate('/home');
                }}
                className="w-full rounded-xl border border-gray-200 py-2.5 sm:py-3 md:py-3.5 text-xs sm:text-sm font-semibold text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50"
              >
                Keep browsing shops
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

