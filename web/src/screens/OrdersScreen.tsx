import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../../src/context/AuthContext';
import {
  getUserOrders,
  subscribeToUserOrders,
} from '../../../src/services/consumer/orderService';
import type { OrderStatus, OrderWithAll } from '../../../src/types/orders';
import { loogin } from '../../../src/lib/loogin';
import LoadingSpinner from '../components/LoadingSpinner';
import OrderCardSkeleton from '../components/skeletons/OrderCardSkeleton';
import { useCart } from '../../../src/context/CartContext';

const log = loogin.scope('web/orders-screen');

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const statusBadgeClasses: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  out_for_delivery: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrdersScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem, updateQuantity, clearCart } = useCart();
  const [orders, setOrders] = useState<OrderWithAll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await getUserOrders();
      setOrders(
        data
          .slice()
          .sort((a, b) => new Date(b.placed_at ?? b.created_at ?? '').getTime() - new Date(a.placed_at ?? a.created_at ?? '').getTime())
      );
    } catch (err) {
      log.error('Failed to load orders', { err });
      setError(err instanceof Error ? err.message : 'Unable to load your orders right now.');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserOrders((updatedOrders) => {
      setOrders(
        (updatedOrders as OrderWithAll[])
          .slice()
          .sort((a, b) => new Date(b.placed_at ?? b.created_at ?? '').getTime() - new Date(a.placed_at ?? a.created_at ?? '').getTime())
      );
    });
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]);

  const handleOrderAgain = useCallback((order: OrderWithAll) => {
    if (!order.order_items || order.order_items.length === 0) {
      log.warn('Cannot reorder: order has no items', { orderId: order.id });
      return;
    }

    const shopId = order.shop_id;
    const shopName = order.shop?.name ?? 'Shop';

    // Clear existing cart for this shop to avoid duplicates
    clearCart(shopId);

    // Add all order items to cart
    order.order_items.forEach((orderItem) => {
      // Add item to cart (will be added with quantity 1 initially)
      addItem({
        id: orderItem.merchant_item_id,
        shopId: shopId,
        shopName: shopName,
        name: orderItem.item_name,
        description: orderItem.item_description ?? undefined,
        image_url: orderItem.item_image_url ?? undefined,
        price_cents: orderItem.item_price_cents,
      });

      // Update quantity to match the order quantity (always set to ensure correct quantity)
      updateQuantity(shopId, orderItem.merchant_item_id, orderItem.quantity);
    });

    // Navigate to checkout with the shop ID
    navigate('/cart', { state: { checkoutShopId: shopId } });
  }, [addItem, updateQuantity, clearCart, navigate, log]);

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-red-200 p-6 sm:p-8 md:p-10 lg:p-12 text-center space-y-3 sm:space-y-4"
        >
          <h2 className="text-lg sm:text-xl font-semibold text-red-600">We hit a snag</h2>
          <p className="text-xs sm:text-sm text-red-500 max-w-md mx-auto px-4">{error}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadOrders}
            className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg text-sm sm:text-base"
          >
            Try again
          </motion.button>
        </motion.div>
      );
    }

    if (!orders.length) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 md:p-10 lg:p-12"
        >
          <div className="text-center py-8 sm:py-10 md:py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-blue-100 rounded-full mb-4 sm:mb-6">
              <span className="text-4xl sm:text-5xl">📦</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No orders yet</h2>
            <p className="text-gray-500 mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-base px-4">
              Your order history will appear here once you place your first order.
            </p>
            <motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/home')}
              className="px-6 sm:px-8 py-2.5 sm:py-3 md:py-3.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold shadow-md hover:shadow-lg text-sm sm:text-base"
            >
              Start shopping
            </motion.button>
          </div>
        </motion.div>
      );
    }

    return (
      <div className="space-y-3 sm:space-y-4">
        {orders.map((order, index) => {
          const totalRupees = Math.round(order.total_cents / 100);
          const shopName = order.shop?.name ?? 'Shop';
          const placedAt = order.placed_at ?? order.created_at ?? null;
          const formattedDate = placedAt
            ? new Date(placedAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : 'Unknown';
          const itemCount = order.order_items?.reduce((count, item) => count + (item.quantity ?? 0), 0) ?? 0;
          const displayItems = order.order_items?.slice(0, 3) ?? [];
          const statusClass = statusBadgeClasses[order.status] ?? 'bg-gray-100 text-gray-800';

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 md:p-6 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-gray-500">Order #{(order.order_number || order.id.slice(0, 8)).toUpperCase()}</p>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mt-1 truncate">{shopName}</h3>
                  <p className="text-xs text-gray-500 mt-1">Placed on {formattedDate}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${statusClass}`}>
                  {statusLabels[order.status] ?? order.status}
                </span>
              </div>

              <div className="mt-4 sm:mt-5 border-t border-gray-100 pt-3 sm:pt-4">
                <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                  Items ({itemCount})
                </p>
                <div className="space-y-2 text-xs sm:text-sm text-gray-600">
                  {displayItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2">
                      <span className="truncate flex-1 min-w-0">
                        {item.item_name || 'Item'}{' '}
                        <span className="text-gray-400">×{item.quantity}</span>
                      </span>
                      <span className="font-semibold text-gray-900 flex-shrink-0">
                        Rs {(Math.round((item.item_price_cents ?? 0) / 100) * (item.quantity ?? 1)).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {order.order_items && order.order_items.length > 3 && (
                    <p className="text-xs text-gray-400">
                      +{order.order_items.length - 3} more item{order.order_items.length - 3 === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 sm:mt-5 border-t border-gray-100 pt-3 sm:pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total paid</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900">Rs {totalRupees.toLocaleString()}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/order/${order.id}`)}
                    className="px-3 sm:px-4 py-2 rounded-lg border border-gray-200 text-xs sm:text-sm font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
                  >
                    View details
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleOrderAgain(order)}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-blue-600 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Order again
                  </motion.button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  }, [loading, error, orders, loadOrders, navigate, handleOrderAgain]);

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8 space-y-6 sm:space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Your orders</h1>
            <p className="text-gray-500 text-xs sm:text-sm md:text-base mt-1">
              Track order progress, review details, and reorder your favourites.
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadOrders}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border border-gray-200 text-xs sm:text-sm font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Refresh
          </motion.button>
        </motion.div>

        {content}
      </div>
    </div>
  );
}