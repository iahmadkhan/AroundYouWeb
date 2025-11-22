import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../../src/context/CartContext';
import { useCartStore } from '../../../src/stores/cartStore';
import { useUserLocation } from '../../../src/hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../../src/context/LocationContext';
import { 
  fetchDeliveryLogic, 
  calculateTotalDeliveryFee,
  calculateDistance 
} from '../../../src/services/merchant/deliveryLogicService';
import type { DeliveryLogic } from '../../../src/services/merchant/deliveryLogicService';
import { supabase } from '../../../src/services/supabase';
import ConfirmationDialog from './ConfirmationDialog';

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

interface SideCartProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string | null;
}

export default function SideCart({ isOpen, onClose, shopId }: SideCartProps) {
  const navigate = useNavigate();
  const { coords } = useUserLocation();
  const { selectedAddress } = useLocationSelection();
  const { getShopCart, removeItem, updateQuantity, getTotalPrice, clearCart } = useCart();
  const shopCarts = useCartStore((state) => state.shopCarts);

  const [shopFees, setShopFees] = useState<ShopFees | null>(null);
  const [loadingFees, setLoadingFees] = useState(true);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Get the current shop cart
  const shopCart = shopId ? getShopCart(shopId) : null;

  // Fetch delivery logic and calculate fees for the current shop
  useEffect(() => {
    const fetchFees = async () => {
      if (!shopId || !shopCart || shopCart.items.length === 0) {
        setShopFees(null);
        setLoadingFees(false);
        return;
      }

      setLoadingFees(true);

      // Get user coordinates
      const userCoords = selectedAddress?.coords || coords;
      if (!userCoords) {
        setLoadingFees(false);
        return;
      }

      // Fetch shop coordinates
      const { data: shopData } = await supabase
        .from('shops')
        .select('latitude, longitude')
        .eq('id', shopId)
        .single();

      // Fetch delivery logic
      const { data: deliveryLogic } = await fetchDeliveryLogic(shopId);
      const subtotal = getTotalPrice(shopId);
      const orderValue = subtotal / 100; // Convert cents to PKR

      let baseDeliveryFee = 0;
      let smallOrderSurcharge = 0;
      let totalDeliveryFee = 0;
      let distanceInMeters: number | undefined;
      let freeDeliveryApplied = false;

      const shopDataTyped = shopData as { latitude?: number; longitude?: number } | null;
      const shopLat = shopDataTyped?.latitude;
      const shopLng = shopDataTyped?.longitude;

      if (deliveryLogic && shopLat && shopLng) {
        // Calculate distance from user to shop
        distanceInMeters = calculateDistance(
          userCoords.latitude,
          userCoords.longitude,
          shopLat,
          shopLng
        );

        // Calculate total delivery fee using the delivery logic service
        const feeCalculation = calculateTotalDeliveryFee(
          orderValue,
          distanceInMeters,
          deliveryLogic
        );

        baseDeliveryFee = feeCalculation.baseFee * 100; // Convert PKR to cents
        smallOrderSurcharge = feeCalculation.surcharge * 100; // Convert PKR to cents
        totalDeliveryFee = feeCalculation.finalFee * 100; // Convert PKR to cents
        freeDeliveryApplied = feeCalculation.freeDeliveryApplied;
      } else if (deliveryLogic) {
        // Fallback: if no shop coordinates, calculate surcharge only
        smallOrderSurcharge = orderValue < deliveryLogic.minimumOrderValue
          ? deliveryLogic.smallOrderSurcharge * 100 // Convert to cents
          : 0;
        // Use maxDeliveryFee as estimate when coordinates unavailable
        baseDeliveryFee = deliveryLogic.maxDeliveryFee * 100; // Convert to cents
        totalDeliveryFee = baseDeliveryFee + smallOrderSurcharge;
      }

      setShopFees({
        shopId,
        deliveryLogic,
        subtotal,
        smallOrderSurcharge,
        baseDeliveryFee,
        totalDeliveryFee,
        distanceInMeters,
        freeDeliveryApplied,
      });

      setLoadingFees(false);
    };

    if (isOpen && shopId) {
      fetchFees();
    }
  }, [isOpen, shopId, shopCart, selectedAddress?.coords, coords, getTotalPrice]);

  // Close cart when shop cart becomes empty
  useEffect(() => {
    if (shopId && (!shopCart || shopCart.items.length === 0)) {
      // Don't auto-close, just clear fees
      setShopFees(null);
    }
  }, [shopId, shopCart]);

  if (!shopId || !shopCart) {
    return null;
  }

  const shopSubtotal = getTotalPrice(shopId);
  const shopTotal = shopSubtotal + (shopFees?.totalDeliveryFee || 0);

  return (
    <AnimatePresence>
      {isOpen && (
    <>
      {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Side Cart */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full sm:w-full sm:max-w-md md:max-w-lg lg:max-w-xl bg-white shadow-2xl z-50 flex flex-col"
      >
        {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 px-4 sm:px-5 md:px-6 py-3 sm:py-4 md:py-5 flex items-center justify-between flex-shrink-0">
              <div className="flex-1 min-w-0 pr-2">
                <h2 className="text-base sm:text-lg md:text-xl font-bold text-white truncate">{shopCart.shopName}</h2>
                <p className="text-white/90 text-xs sm:text-sm mt-1">
              {shopCart.items.length} item{shopCart.items.length !== 1 ? 's' : ''} in cart
            </p>
          </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="text-white/90 hover:text-white transition-colors p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
              </motion.button>
        </div>

        {/* Cart Items */}
            <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          {shopCart.items.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-12"
                >
              <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
                <span className="text-4xl">🛒</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Your cart is empty</h3>
              <p className="text-gray-500">Add items to get started</p>
                </motion.div>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                    <AnimatePresence>
                      {shopCart.items.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2, delay: index * 0.05 }}
                          className="flex items-center gap-2 sm:gap-3 md:gap-4 pb-3 sm:pb-4 border-b border-gray-100 last:border-0"
                        >
                          <div className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {item.image_url ? (
                              <motion.img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3 }}
                              />
                      ) : (
                        <span className="text-2xl">📦</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                            <p className="text-sm sm:text-base font-medium text-gray-900 mb-1 truncate">{item.name}</p>
                            <p className="text-xs sm:text-sm text-gray-600 mb-2">Rs. {(item.price_cents / 100).toFixed(2)}</p>
                      <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-2 py-1 bg-white">
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                            onClick={() => {
                              if (item.quantity > 1) {
                                updateQuantity(shopId, item.id, item.quantity - 1);
                              } else {
                                removeItem(shopId, item.id);
                              }
                            }}
                            className="text-gray-600 hover:text-gray-900 transition-colors w-6 h-6 flex items-center justify-center"
                          >
                            −
                                </motion.button>
                                <span className="text-sm font-medium w-6 text-center text-gray-900">{item.quantity}</span>
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                            onClick={() => updateQuantity(shopId, item.id, item.quantity + 1)}
                            className="text-gray-600 hover:text-gray-900 transition-colors w-6 h-6 flex items-center justify-center"
                          >
                            +
                                </motion.button>
                        </div>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                          onClick={() => removeItem(shopId, item.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors p-1"
                          title="Remove item"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                              </motion.button>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                            <p className="text-sm sm:text-base font-semibold text-blue-600">
                        Rs. {((item.price_cents * item.quantity) / 100).toFixed(2)}
                      </p>
                    </div>
                        </motion.div>
                ))}
                    </AnimatePresence>
              </div>

              {/* Bill Details */}
              {shopFees && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gray-50 rounded-xl p-3 sm:p-4 space-y-2 sm:space-y-3 mb-3 sm:mb-4"
                    >
                      <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-2">Bill Details</h3>
                  
                  {/* Items Subtotal */}
                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-sm font-medium text-gray-700">Items Subtotal</span>
                    <span className="text-base font-bold text-gray-900">Rs. {(shopSubtotal / 100).toFixed(2)}</span>
                  </div>

                  {shopFees.deliveryLogic && (
                    <>
                      {/* Small Order Surcharge */}
                      {shopFees.smallOrderSurcharge > 0 && (
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <div>
                            <span className="text-sm text-gray-700 font-medium">Small Order Surcharge</span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Below Rs. {shopFees.deliveryLogic.minimumOrderValue.toFixed(2)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-gray-900">Rs. {(shopFees.smallOrderSurcharge / 100).toFixed(2)}</span>
                        </div>
                      )}

                      {/* Delivery Fee */}
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <div>
                          <span className="text-sm text-gray-700 font-medium">Delivery Fee</span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {shopFees.freeDeliveryApplied ? (
                              <span className="text-green-600 font-medium">Free delivery!</span>
                            ) : shopFees.distanceInMeters ? (
                              `${(shopFees.distanceInMeters / 1000).toFixed(2)} km`
                            ) : (
                              'Base charge'
                            )}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                          {loadingFees ? '...' : shopFees.freeDeliveryApplied ? (
                            <span className="text-green-600">Free</span>
                          ) : (
                            `Rs. ${(shopFees.baseDeliveryFee / 100).toFixed(2)}`
                          )}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Total */}
                  <div className="flex justify-between items-center pt-3 mt-2 border-t-2 border-gray-300">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <span className="text-xl font-bold text-blue-600">
                      {loadingFees ? (
                        <span className="text-gray-400">...</span>
                      ) : (
                        `Rs. ${(shopTotal / 100).toFixed(2)}`
                      )}
                    </span>
                  </div>
                    </motion.div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        {shopCart.items.length > 0 && (
              <div className="border-t border-gray-200 px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-gray-50 flex-shrink-0 space-y-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!shopId) {
                  return;
                }
                onClose();
                navigate('/cart', { state: { checkoutShopId: shopId } });
              }}
                  className="w-full bg-blue-600 text-white py-2.5 sm:py-3 md:py-3.5 rounded-xl font-semibold text-sm sm:text-base md:text-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
            >
              Checkout
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
              onClick={() => setShowClearConfirm(true)}
              className="w-full bg-gray-200 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-300 transition-colors"
            >
              Clear Cart
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/cart')}
              className="w-full text-blue-600 py-2.5 rounded-xl font-medium hover:bg-blue-50 transition-colors"
            >
              View Full Cart
                </motion.button>
          </div>
        )}
          </motion.div>

      {/* Clear Cart Confirmation */}
      <ConfirmationDialog
        isOpen={showClearConfirm}
        title="Clear Cart"
        message={`Are you sure you want to remove all items from ${shopCart.shopName}? This action cannot be undone.`}
        confirmText="Clear Cart"
        cancelText="Cancel"
        variant="warning"
        onConfirm={() => {
          clearCart(shopId);
          setShowClearConfirm(false);
        }}
        onCancel={() => setShowClearConfirm(false)}
      />
    </>
      )}
    </AnimatePresence>
  );
}

