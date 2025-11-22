import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../../src/context/AuthContext';
import { supabase } from '../../../../src/services/supabase';
import { getShopOrders, subscribeToShopOrders } from '../../../../src/services/merchant/orderService';
import type { OrderStatus, OrderWithAll } from '../../../../src/types/orders';
import { loogin } from '../../../../src/lib/loogin';
import LoadingSpinner from '../../components/LoadingSpinner';

const log = loogin.scope('web/merchant-orders-screen');

export default function MerchantOrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithAll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchedShopIds, setWatchedShopIds] = useState<string[]>([]);

  const loadOrders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      
      // First, get merchant account
      const { data: merchantAccount, error: merchantError } = await supabase
        .from('merchant_accounts')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (merchantError || !merchantAccount) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const merchantId = (merchantAccount as { id: string }).id;

      // Get all shops for this merchant
      const { data: shops, error: shopsError } = await supabase
        .from('shops')
        .select('id, name')
        .eq('merchant_id', merchantId);

      if (shopsError || !shops || shops.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const typedShops: Array<{ id: string; name: string }> = (shops ?? []).map((shop) => ({
        id: (shop as any).id,
        name: (shop as any).name,
      }));

      const ordersByShop = await Promise.all(
        typedShops.map(async (shop: { id: string; name: string }) => {
          try {
            const shopOrders = await getShopOrders(shop.id);
            return shopOrders.map((order) => ({
              ...order,
              shop: order.shop ?? {
                id: shop.id,
                name: shop.name,
              },
            }));
          } catch (shopError) {
            log.error('Failed to fetch orders for shop', { shopId: shop.id, error: shopError });
            return [];
          }
        })
      );

      const mergedOrders = ordersByShop
        .flat()
        .sort((a, b) => {
          const aTime = new Date(a.placed_at ?? a.created_at ?? '').getTime();
          const bTime = new Date(b.placed_at ?? b.created_at ?? '').getTime();
          return bTime - aTime;
        });

      setOrders(mergedOrders);
      setWatchedShopIds(typedShops.map((shop) => shop.id));
    } catch (err: any) {
      log.error('Error loading orders', { error: err });
      setError(err.message || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrders();
  }, [user, loadOrders]);

  // Subscription key for watching shop orders
  const subscriptionsKey = useMemo(() => watchedShopIds.slice().sort().join('|'), [watchedShopIds]);

  // Subscribe to shop orders updates
  useEffect(() => {
    if (!user || !watchedShopIds.length) {
      return;
    }

    const unsubscribeAll = watchedShopIds.map((shopId) =>
      subscribeToShopOrders(shopId, () => {
        loadOrders();
      })
    );

    return () => {
      unsubscribeAll.forEach((unsubscribe) => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [user, subscriptionsKey, loadOrders, watchedShopIds]);

  const statusStyles: Record<OrderStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    out_for_delivery: 'bg-indigo-100 text-indigo-800',
    delivered: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  const getStatusColor = (status: string) => {
    const normalized = status.toLowerCase() as OrderStatus;
    return statusStyles[normalized] || 'bg-gray-100 text-gray-800';
  };

  const formatStatus = (status: string) =>
    status
      .replace(/_/g, ' ')
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const formatDate = (dateString?: string | null) => {
    if (!dateString) {
      return '--';
    }
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return '--';
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Orders</h1>
          <p className="text-gray-500 text-lg">View and manage all your orders</p>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <LoadingSpinner text="Loading orders..." />
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8">
            <div className="flex flex-col items-center justify-center py-8">
              <p className="text-red-600 font-semibold mb-2 text-lg">Error loading orders</p>
              <p className="text-red-500 text-sm mb-4">{error}</p>
              <button
                onClick={loadOrders}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-12">
            <div className="flex flex-col items-center justify-center py-12">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 rounded-full mb-6">
                <span className="text-5xl">📦</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No orders yet</h2>
              <p className="text-gray-500 text-center max-w-md">
                Orders from your shops will appear here once customers start placing orders.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200"
              >
                <div className="flex flex-row items-start justify-between mb-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 mb-1">
                      Order #{(order.order_number || order.id.slice(0, 8)).toUpperCase()}
                    </p>
                    {order.shop?.name && (
                      <p className="text-lg font-semibold text-gray-900">{order.shop?.name}</p>
                    )}
                    {order.order_items?.length ? (
                      <p className="text-xs text-gray-500 mt-1">
                        {order.order_items.length}{' '}
                        item{order.order_items.length === 1 ? '' : 's'}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}
                  >
                    {formatStatus(order.status)}
                  </span>
                </div>

                <div className="flex flex-row items-center justify-between pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Amount</p>
                    <p className="text-xl font-bold text-gray-900">
                      Rs {Math.round(order.total_cents / 100).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Date</p>
                    <p className="text-sm font-medium text-gray-700">
                      {formatDate(order.placed_at ?? order.created_at)}
                    </p>
                  </div>
                </div>

                {order.order_items && order.order_items.length > 0 && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
                      Items
                    </p>
                    <div className="space-y-2">
                      {order.order_items.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-sm text-gray-700"
                        >
                          <span className="truncate">
                            {item.item_name}
                            <span className="ml-2 text-gray-400">×{item.quantity}</span>
                          </span>
                          <span className="font-semibold text-gray-900">
                            Rs {Math.round(item.subtotal_cents / 100).toLocaleString()}
                          </span>
                        </div>
                      ))}
                      {order.order_items.length > 3 && (
                        <p className="text-xs text-gray-400">
                          +{order.order_items.length - 3} more item
                          {order.order_items.length - 3 === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
