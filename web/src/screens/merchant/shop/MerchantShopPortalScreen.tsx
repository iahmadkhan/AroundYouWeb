import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../../../../src/services/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';
import AddItemModal from '../../../components/AddItemModal';
import { getImageUrl } from '../../../utils/imageUtils';
import { useDeliveryLogic, useSaveDeliveryLogic } from '../../../../../src/hooks/merchant/useDeliveryLogic';
import type { DeliveryLogicPayload } from '../../../../../src/services/merchant/deliveryLogicService';
import { useShopAnalytics } from '../../../../../src/hooks/merchant/useAnalytics';
import { useShopOrders } from '../../../../../src/hooks/merchant/useShopOrders';
import { useInventoryItems } from '../../../../../src/hooks/merchant/useInventoryItems';
import { useQuery, useQueryClient } from 'react-query';
import { getOrderById, confirmOrder, markOrderDelivered, cancelOrder, getDeliveryRunnersWithStatus, assignRunnerAndDispatch } from '../../../../../src/services/merchant/orderService';
import type { OrderWithAll } from '../../../../../src/types/orders';
import { useAuth } from '../../../../../src/context/AuthContext';
import { useMerchantAccount } from '../../../../../src/hooks/merchant/useMerchantAccount';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'orders', label: 'Orders' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'settings', label: 'Settings' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// Delivery Logic Component
function DeliveryLogicSection({ shopId }: { shopId: string }) {
  const { data: deliveryLogic, isLoading: isLoadingLogic } = useDeliveryLogic(shopId);
  const saveLogicMutation = useSaveDeliveryLogic(shopId);
  const [logicForm, setLogicForm] = useState<DeliveryLogicPayload>({} as DeliveryLogicPayload);

  useEffect(() => {
    if (deliveryLogic) {
      setLogicForm({
        minimumOrderValue: deliveryLogic.minimumOrderValue,
        smallOrderSurcharge: deliveryLogic.smallOrderSurcharge,
        leastOrderValue: deliveryLogic.leastOrderValue,
        distanceMode: deliveryLogic.distanceMode,
        maxDeliveryFee: deliveryLogic.maxDeliveryFee,
        distanceTiers: deliveryLogic.distanceTiers,
        beyondTierFeePerUnit: deliveryLogic.beyondTierFeePerUnit,
        beyondTierDistanceUnit: deliveryLogic.beyondTierDistanceUnit,
        freeDeliveryThreshold: deliveryLogic.freeDeliveryThreshold,
        freeDeliveryRadius: deliveryLogic.freeDeliveryRadius,
      });
    }
  }, [deliveryLogic]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="px-8 py-4 border-b border-gray-200">
        <div className="text-lg font-semibold text-gray-900">Delivery Logic & Fees</div>
      </div>
      <div className="p-8 space-y-6">
        {isLoadingLogic ? (
          <div className="text-center text-gray-500 py-8">Loading...</div>
        ) : (
          <>
              {/* Order Value Layer */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Order Value Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Order Value (PKR) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={logicForm.minimumOrderValue ?? deliveryLogic?.minimumOrderValue ?? 200}
                      onChange={(e) => setLogicForm({ ...logicForm, minimumOrderValue: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="200.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Orders below this get a surcharge. Recommended: 200-500 PKR.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Small Order Surcharge (PKR) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={logicForm.smallOrderSurcharge ?? deliveryLogic?.smallOrderSurcharge ?? 40}
                      onChange={(e) => setLogicForm({ ...logicForm, smallOrderSurcharge: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="40.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Additional fee for orders below minimum. Typical: 30-50 PKR.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Least Order Value (PKR) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={logicForm.leastOrderValue ?? deliveryLogic?.leastOrderValue ?? 100}
                      onChange={(e) => setLogicForm({ ...logicForm, leastOrderValue: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="100.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">*Critical:* Orders below this are rejected. Must be ≤ Minimum Order Value.</p>
                  </div>
                </div>
              </div>

              {/* Distance Layer */}
              <div className="space-y-4 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Distance-Based Fees</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Delivery Fee (PKR) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={logicForm.maxDeliveryFee ?? deliveryLogic?.maxDeliveryFee ?? 130}
                      onChange={(e) => setLogicForm({ ...logicForm, maxDeliveryFee: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="130.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum cap for delivery fees. Typical: 100-200 PKR.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Distance Mode
                    </label>
                    <select
                      value={logicForm.distanceMode ?? deliveryLogic?.distanceMode ?? 'auto'}
                      onChange={(e) => setLogicForm({ ...logicForm, distanceMode: e.target.value as 'auto' | 'custom' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="auto">Auto (Default Algorithm)</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
                
                {/* Distance Tiers */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Distance Tiers (meters → PKR) <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-3">Define distance ranges and fees. Tiers must be in ascending order.</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {(logicForm.distanceTiers ?? deliveryLogic?.distanceTiers ?? []).map((tier, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={tier.max_distance}
                          onChange={(e) => {
                            const newTiers = [...(logicForm.distanceTiers ?? deliveryLogic?.distanceTiers ?? [])];
                            newTiers[index] = { ...tier, max_distance: parseInt(e.target.value) || 0 };
                            setLogicForm({ ...logicForm, distanceTiers: newTiers });
                          }}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="Distance (m)"
                        />
                        <span className="text-sm text-gray-500">→</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={tier.fee}
                          onChange={(e) => {
                            const newTiers = [...(logicForm.distanceTiers ?? deliveryLogic?.distanceTiers ?? [])];
                            newTiers[index] = { ...tier, fee: parseFloat(e.target.value) || 0 };
                            setLogicForm({ ...logicForm, distanceTiers: newTiers });
                          }}
                          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                          placeholder="Fee (PKR)"
                        />
                        <button
                          onClick={() => {
                            const newTiers = (logicForm.distanceTiers ?? deliveryLogic?.distanceTiers ?? []).filter((_, i) => i !== index);
                            setLogicForm({ ...logicForm, distanceTiers: newTiers });
                          }}
                          className="text-red-500 hover:text-red-700 px-3 py-2"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newTiers = [...(logicForm.distanceTiers ?? deliveryLogic?.distanceTiers ?? []), { max_distance: 0, fee: 0 }];
                        setLogicForm({ ...logicForm, distanceTiers: newTiers });
                      }}
                      className="w-full text-sm text-blue-600 hover:text-blue-700 py-2 border border-blue-200 rounded hover:bg-blue-50"
                    >
                      + Add Tier
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Beyond Tier Fee/Unit (PKR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={logicForm.beyondTierFeePerUnit ?? deliveryLogic?.beyondTierFeePerUnit ?? 10}
                      onChange={(e) => setLogicForm({ ...logicForm, beyondTierFeePerUnit: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="10.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Distance Unit (meters)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={logicForm.beyondTierDistanceUnit ?? deliveryLogic?.beyondTierDistanceUnit ?? 250}
                      onChange={(e) => setLogicForm({ ...logicForm, beyondTierDistanceUnit: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="250"
                    />
                  </div>
                </div>
              </div>

              {/* Free Delivery */}
              <div className="space-y-4 pt-6 border-t border-gray-200">
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Free Delivery</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Order Threshold (PKR)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={logicForm.freeDeliveryThreshold ?? deliveryLogic?.freeDeliveryThreshold ?? 800}
                      onChange={(e) => setLogicForm({ ...logicForm, freeDeliveryThreshold: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="800.00"
                    />
                    <p className="text-xs text-gray-500 mt-1">Minimum order value for free delivery.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Radius (meters)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={logicForm.freeDeliveryRadius ?? deliveryLogic?.freeDeliveryRadius ?? 1000}
                      onChange={(e) => setLogicForm({ ...logicForm, freeDeliveryRadius: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="1000"
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum distance for free delivery.</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">*Both conditions must be met: Order value ≥ Threshold AND Distance ≤ Radius.</p>
              </div>

              {/* Save Button */}
              <button
                onClick={async () => {
                  try {
                    await saveLogicMutation.mutateAsync(logicForm);
                    alert('Delivery logic saved successfully!');
                  } catch (error: any) {
                    alert(error.message || 'Failed to save delivery logic');
                  }
                }}
                disabled={saveLogicMutation.isLoading}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveLogicMutation.isLoading ? 'Saving...' : 'Save Delivery Logic'}
              </button>
            </>
        )}
      </div>
    </div>
  );
}

interface Order {
  id: string;
  consumer_id: string;
  status: string;
  total_cents?: number;
  total_amount?: number; // Legacy field for backward compatibility
  created_at: string;
  updated_at: string;
}

interface InventoryItem {
  id: string;
  name: string | null;
  sku: string | null;
  price_cents: number;
  is_active: boolean;
  image_url?: string | null;
  description?: string | null;
  barcode?: string | null;
  template_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface MerchantShopPortalScreenProps {
  shop?: any;
  activeTab?: TabKey;
  hideTabs?: boolean;
}

export default function MerchantShopPortalScreen({ 
  shop: propShop, 
  activeTab: propActiveTab, 
  hideTabs = false 
}: MerchantShopPortalScreenProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const shop = propShop || (location.state as any)?.shop;
  const [activeTab, setActiveTab] = useState<TabKey>(propActiveTab || 'dashboard');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithAll | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const queryClient = useQueryClient();
  
  // Auth + merchant readiness check to prevent opening modal before hydration completes
  const { user, loading: authLoading } = useAuth();
  const { data: merchantAccount, isLoading: merchantLoading } = useMerchantAccount(user?.id);
  const isAuthReady = !authLoading && !!user;
  const isMerchantReady = !merchantLoading && !!merchantAccount;
  const isReady = isAuthReady && isMerchantReady;
  
  // WebSocket-first real-time orders - no polling, no fallbacks
  const { data: ordersData = [], isLoading: ordersLoading, isConnected } = useShopOrders(
    shop?.id,
    50
  );
  
  const inventoryParams = useMemo(() => ({
    limit: 100,
    active: undefined,
  }), []);
  
  const { data: inventoryData, isLoading: inventoryLoading } = useInventoryItems(
    shop?.id || '',
    inventoryParams
  );
  
  const { data: shopAnalytics, isLoading: analyticsLoading } = useShopAnalytics(shop?.id || '');
  
  // Calculate stats from cached data
  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayOrders = ordersData.filter((o: any) => o.created_at?.startsWith(today));
    const totalRevenue = ordersData
      .filter((o: any) => o.status === 'completed' || o.status === 'delivered')
      .reduce((sum: number, o: any) => {
        // Use total_cents if available, otherwise fallback to total_amount (in rupees, convert to cents)
        const totalCents = o.total_cents || (o.total_amount ? o.total_amount * 100 : 0);
        return sum + (Number(totalCents) || 0);
      }, 0) / 100; // Convert cents to rupees
    const activeItems = inventoryData?.items?.filter((i: any) => i.isActive !== false).length || 0;
    
    return {
      totalOrders: ordersData.length,
      todayOrders: todayOrders.length,
      totalRevenue,
      activeItems,
    };
  }, [ordersData, inventoryData]);
  
  const loading = ordersLoading || inventoryLoading || analyticsLoading;

  useEffect(() => {
    if (propActiveTab) {
      setActiveTab(propActiveTab);
    }
  }, [propActiveTab]);
  
  // Transform inventory data for display
  const inventoryItems = useMemo(() => {
    return inventoryData?.items || [];
  }, [inventoryData]);
  
  // Transform orders data for display
  const orders = useMemo(() => {
    console.log('🔄 MerchantShopPortalScreen: Orders data updated, count:', ordersData?.length || 0);
    // ShopOrder is compatible with Order for display purposes
    return ordersData as unknown as Order[];
  }, [ordersData]);
  
  // Debug log for order status changes
  useEffect(() => {
    if (orders.length > 0) {
      console.log('📊 MerchantShopPortalScreen: Current orders in state:', orders.map(o => ({ id: o.id.slice(0, 8), status: o.status })));
    }
  }, [orders]);

  // Auto-close modal when order reaches terminal state (delivered/cancelled)
  useEffect(() => {
    if (showUpdateStatus && selectedOrder) {
      if (selectedOrder.status === 'delivered' || selectedOrder.status === 'cancelled') {
        console.log('🔄 MerchantShopPortalScreen: Order reached terminal state, auto-closing modal:', selectedOrder.status);
        setShowUpdateStatus(false);
        setSelectedOrder(null);
      }
    }
  }, [showUpdateStatus, selectedOrder?.status]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!shop) {
    return (
      <div className="w-full min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-4">Shop not found</p>
          <button
            onClick={() => navigate('/merchantdashboard')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          {!hideTabs && (
            <button
              onClick={() => navigate('/merchantdashboard')}
              className="text-blue-600 hover:text-blue-700 mb-4 flex items-center gap-2"
            >
              <span>←</span>
              <span>Back to Shops</span>
            </button>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{shop.name}</h1>
          {!hideTabs && <p className="text-gray-500 text-lg">Shop Workspace</p>}
        </div>

        {/* Horizontal Tabs Navigation - Hidden when hideTabs is true */}
        {!hideTabs && (
          <div className="bg-white border-b border-gray-200 shadow-sm rounded-t-xl mb-6">
            <div className="flex gap-1 px-4">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-6 py-4 text-sm font-semibold transition-all duration-200 border-b-2 ${
                      isActive
                        ? 'text-blue-600 border-blue-600 bg-blue-50/50'
                        : 'text-gray-600 border-transparent hover:text-blue-600 hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="w-full">
          {loading && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <LoadingSpinner text="Loading..." />
            </div>
          )}

          {!loading && activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Total Orders</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">📦</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Today's Orders</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.todayOrders}</p>
                    </div>
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">📊</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900">Rs {(stats.totalRevenue || 0).toLocaleString()}</p>
                    </div>
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">💰</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500 text-sm mb-1">Active Items</p>
                      <p className="text-2xl font-bold text-gray-900">{stats.activeItems}</p>
                    </div>
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <span className="text-2xl">📋</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Orders */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Orders</h2>
                {orders.length === 0 ? (
                  <p className="text-gray-500">No orders yet</p>
                ) : (
                  <div className="space-y-3">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div>
                          <p className="text-sm text-gray-500">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-base font-semibold text-gray-900">
                            Rs {Math.round(((order.total_cents || order.total_amount || 0) / 100)).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {!loading && activeTab === 'inventory' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Inventory</h2>
                <button
                  onClick={() => setShowAddItemModal(true)}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200"
                >
                  + Add Item
                </button>
              </div>

              {inventoryItems.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-gray-100 rounded-full mb-6">
                    <span className="text-5xl">📦</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No items yet</h3>
                  <p className="text-gray-500 mb-6">Start adding items to your inventory</p>
                  <button
                    onClick={() => setShowAddItemModal(true)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200"
                  >
                    Add Your First Item
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {inventoryItems.map((item) => (
                    <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all">
                      <div className="w-full h-32 mb-4 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center">
                        {(() => {
                          const imageUrl = getImageUrl(item.image_url);
                          return imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt={item.name || 'Item'} 
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                // Fallback to placeholder if image fails to load
                                console.error('Image failed to load:', imageUrl, 'Original:', item.image_url);
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent && !parent.querySelector('span')) {
                                  const placeholder = document.createElement('span');
                                  placeholder.className = 'text-4xl';
                                  placeholder.textContent = '📦';
                                  parent.appendChild(placeholder);
                                }
                              }}
                              onLoad={() => {
                                console.log('Image loaded successfully:', imageUrl);
                              }}
                            />
                          ) : (
                            <span className="text-4xl">📦</span>
                          );
                        })()}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.name || 'Unnamed Item'}</h3>
                      {item.sku && (
                        <p className="text-sm text-gray-500 mb-2">SKU: {item.sku}</p>
                      )}
                      <p className="text-xl font-bold text-blue-600 mb-3">Rs {((item.price_cents || 0) / 100).toLocaleString()}</p>
                      <div className="flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          item.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => alert('Edit feature coming soon!')}
                          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === 'orders' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Orders</h2>
              {orders.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                  <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 rounded-full mb-6">
                    <span className="text-5xl">📦</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">No orders yet</h3>
                  <p className="text-gray-500">Orders from customers will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Order #{order.id.slice(0, 8)}</p>
                          <p className="text-lg font-semibold text-gray-900">
                            Rs {Math.round(((order.total_cents || order.total_amount || 0) / 100)).toLocaleString()}
                          </p>
                          <p className="text-sm text-gray-500 mt-1">{formatDate(order.created_at)}</p>
                        </div>
                        <span className={`px-4 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            try {
                              if (!shop?.id) {
                                alert('Shop information not available');
                                return;
                              }
                              console.log('Loading order details for:', order.id, 'shop:', shop.id);
                              const fullOrder = await getOrderById(order.id, shop.id);
                              if (fullOrder) {
                                console.log('Order loaded successfully:', fullOrder.id);
                                setSelectedOrder(fullOrder);
                                setShowOrderDetails(true);
                              } else {
                                console.error('Failed to load order - order not found or access denied');
                                alert('Failed to load order details. The order may not exist or you may not have access to it.');
                              }
                            } catch (error) {
                              console.error('Error loading order details:', error);
                              alert(`Failed to load order details: ${error instanceof Error ? error.message : 'Unknown error'}`);
                            }
                          }}
                          className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors"
                        >
                          View Details
                        </button>
                        {(order.status === 'pending' || order.status === 'confirmed' || order.status === 'out_for_delivery') && (
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              
                              // CRITICAL: Don't allow opening modal until auth + merchant are fully ready
                              if (!isReady) {
                                console.warn('Update Status: Auth/merchant not ready yet, please wait...');
                                alert('Please wait a moment for your account to connect before updating order status.');
                                return;
                              }
                              
                              try {
                                if (!shop?.id) {
                                  console.error('❌ Update Status: Shop information not available');
                                  alert('Shop information not available');
                                  return;
                                }
                                console.log('🔵 Update Status button clicked:', {
                                  orderId: order.id,
                                  shopId: shop.id,
                                  currentStatus: order.status,
                                  isReady: true
                                });
                                
                                // Prefetch runners immediately when button is clicked (before modal opens)
                                // This ensures runners are ready instantly when modal opens
                                if ((order.status === 'pending' || order.status === 'confirmed') && shop.id) {
                                  console.log('⚡ Prefetching runners before opening modal...');
                                  queryClient.prefetchQuery(
                                    ['delivery-runners', shop.id],
                                    async () => {
                                      const queryPromise = supabase
                                        .from('delivery_runners')
                                        .select('id, shop_id, name, phone_number, created_at, updated_at')
                                        .eq('shop_id', shop.id)
                                        .limit(30);
                                      
                                      const timeoutPromise = new Promise<{ data: any[]; error: null }>((resolve) => {
                                        setTimeout(() => resolve({ data: [], error: null }), 800);
                                      });
                                      
                                      const result: any = await Promise.race([queryPromise, timeoutPromise]);
                                      return (result.data || []).sort((a: any, b: any) => 
                                        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                                      );
                                    },
                                    { staleTime: 120000 }
                                  );
                                }
                                
                                // Use the order from the list directly instead of refetching
                                // Since getOrderById is hanging, we'll use the existing order data
                                // The UpdateStatusModal mainly needs order.id and order.status, which we already have
                                console.log('✅ Update Status: Using existing order data from list, skipping slow refetch');
                                
                                // Cast to any first, then to OrderWithAll to avoid type issues
                                // The modal will work with just the id and status
                                const fullOrder = {
                                  ...order,
                                  shop_id: shop.id,
                                } as unknown as OrderWithAll;
                                
                                console.log('✅ Update Status: Order data ready for update:', {
                                  orderId: fullOrder.id,
                                  status: fullOrder.status,
                                  hasOrderItems: !!(fullOrder as any).order_items?.length
                                });
                                
                                console.log('🔵 Update Status: Setting selectedOrder and showUpdateStatus to true');
                                setSelectedOrder(fullOrder);
                                setShowUpdateStatus(true);
                                
                                console.log('✅ Update Status: Modal should now open');
                              } catch (error) {
                                console.error('❌ Update Status: Exception:', error);
                                alert(`Failed to open update modal: ${error instanceof Error ? error.message : 'Unknown error'}`);
                              }
                            }}
                            disabled={!isReady}
                            className="px-4 py-2 bg-green-50 text-green-600 rounded-lg font-medium hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={!isReady ? 'Please wait for your account to connect...' : 'Update order status'}
                          >
                            {!isReady ? 'Connecting...' : 'Update Status'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && activeTab === 'analytics' && (
            <ShopAnalyticsScreen analytics={shopAnalytics} loading={analyticsLoading} />
          )}

          {!loading && activeTab === 'delivery' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Delivery Areas</h2>
                <p className="text-gray-600 mb-6">
                  Manage the areas where you deliver. Set up delivery zones and delivery fees for each area.
                </p>
                <button
                  onClick={() => navigate('/managedeliveryareas', { state: { shop } })}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Manage Delivery Areas
                </button>
              </div>
              
              <DeliveryLogicSection shopId={shop?.id || ''} />
            </div>
          )}

          {!loading && activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Shop Settings</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-gray-900">Shop Name</p>
                      <p className="text-sm text-gray-500">{shop.name}</p>
                    </div>
                    <button
                      onClick={() => alert('Edit shop name feature coming soon!')}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-gray-900">Shop Type</p>
                      <p className="text-sm text-gray-500">{shop.shop_type || 'Not set'}</p>
                    </div>
                    <button
                      onClick={() => alert('Edit shop type feature coming soon!')}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-gray-900">Status</p>
                      <p className="text-sm text-gray-500">{shop.is_open ? 'Open' : 'Closed'}</p>
                    </div>
                    <button
                      onClick={() => alert('Toggle status feature coming soon!')}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Toggle
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {shop && (
        <AddItemModal
          shopId={shop.id}
          isOpen={showAddItemModal}
          onClose={() => setShowAddItemModal(false)}
          onSuccess={() => {
            // Invalidate and refetch inventory cache
            queryClient.invalidateQueries({ queryKey: ['inventory', shop?.id] });
          }}
        />
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => {
            setShowOrderDetails(false);
            setSelectedOrder(null);
          }}
        />
      )}

      {/* Update Status Modal */}
      {showUpdateStatus && selectedOrder ? (
        selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' ? (
            <UpdateStatusModal
              order={selectedOrder}
              shopId={shop?.id || ''}
              onClose={() => {
                console.log('🔵 Update Status Modal: onClose called');
                // Reset state immediately to ensure next update works
                setShowUpdateStatus(false);
                setSelectedOrder(null);
                // Force a small delay to ensure state is fully reset before next modal open
                setTimeout(() => {
                  // State is now clean for next update
                }, 50);
              }}
            onSuccess={async (runnerInfo?: { runnerId: string; runnerName?: string }) => {
              // WebSocket will handle all updates automatically - no manual cache manipulation needed
              console.log('✅ Update Status Modal: Status update completed, WebSocket will update UI in real-time');
            }}
            />
        ) : (
          // Order is in terminal state (delivered/cancelled), auto-close modal
          (() => {
            console.log('🔄 Update Status Modal: Order reached terminal state, auto-closing modal:', selectedOrder.status);
            // Auto-close after a brief delay to allow state to settle
            setTimeout(() => {
              setShowUpdateStatus(false);
              setSelectedOrder(null);
            }, 100);
            return null;
        })()
        )
      ) : (
        showUpdateStatus && !selectedOrder && console.log('⚠️ Update Status Modal: showUpdateStatus is true but selectedOrder is null:', {
          showUpdateStatus,
          selectedOrder: selectedOrder
        })
      )}
    </div>
  );
}

// Order Details Modal Component
function OrderDetailsModal({ order, onClose }: { order: OrderWithAll; onClose: () => void }) {
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatStatus = (status: string) =>
    status
      .replace(/_/g, ' ')
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'out_for_delivery':
        return 'bg-indigo-100 text-indigo-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Order Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">
                Order #{order.order_number || order.id.slice(0, 8).toUpperCase()}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                Rs {Math.round((order.total_cents || 0) / 100).toLocaleString()}
              </p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
              {formatStatus(order.status)}
            </span>
          </div>

          {/* Order Items */}
          {order.order_items && order.order_items.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Items</h3>
              <div className="space-y-2">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{item.item_name}</p>
                      <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    </div>
                    <p className="font-semibold text-gray-900">
                      Rs {Math.round((item.subtotal_cents || 0) / 100).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order Summary */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>Rs {Math.round((order.subtotal_cents || 0) / 100).toLocaleString()}</span>
              </div>
              {order.delivery_fee_cents > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Delivery Fee</span>
                  <span>Rs {Math.round((order.delivery_fee_cents || 0) / 100).toLocaleString()}</span>
                </div>
              )}
              {order.surcharge_cents > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>Surcharge</span>
                  <span>Rs {Math.round((order.surcharge_cents || 0) / 100).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total</span>
                <span>Rs {Math.round((order.total_cents || 0) / 100).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Order Information */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method</span>
                <span className="font-medium text-gray-900 capitalize">{order.payment_method || '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Placed At</span>
                <span className="font-medium text-gray-900">{formatDate(order.placed_at || order.created_at)}</span>
              </div>
              {order.confirmed_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Confirmed At</span>
                  <span className="font-medium text-gray-900">{formatDate(order.confirmed_at)}</span>
                </div>
              )}
              {order.out_for_delivery_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Out for Delivery At</span>
                  <span className="font-medium text-gray-900">{formatDate(order.out_for_delivery_at)}</span>
                </div>
              )}
              {order.delivered_at && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivered At</span>
                  <span className="font-medium text-gray-900">{formatDate(order.delivered_at)}</span>
                </div>
              )}
              {order.special_instructions && (
                <div className="pt-2">
                  <span className="text-gray-600 block mb-1">Special Instructions</span>
                  <span className="font-medium text-gray-900">{order.special_instructions}</span>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Address */}
          {order.delivery_address && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Delivery Address</h3>
              <div className="text-sm text-gray-700">
                <p>{order.delivery_address.street_address}</p>
                {order.delivery_address.city && <p>{order.delivery_address.city}</p>}
                {order.delivery_address.region && <p>{order.delivery_address.region}</p>}
                {order.delivery_address.formatted_address && (
                  <p className="text-gray-500 italic">{order.delivery_address.formatted_address}</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Update Status Modal Component
function UpdateStatusModal({ 
  order, 
  shopId, 
  onClose, 
  onSuccess 
}: { 
  order: OrderWithAll; 
  shopId: string;
  onClose: () => void; 
  onSuccess: (runnerInfo?: { runnerId: string; runnerName?: string }) => Promise<void>;
}) {
  // Auth + merchant readiness gating to avoid firing status updates before
  // Supabase session / merchant context are fully hydrated (especially in new tabs)
  const { user, loading: authLoading } = useAuth();
  const { data: merchantAccount, isLoading: merchantLoading } = useMerchantAccount(user?.id);

  const isAuthReady = !authLoading && !!user;
  const isMerchantReady = !merchantLoading && !!merchantAccount;
  const isReady = isAuthReady && isMerchantReady;
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [runners, setRunners] = useState<any[]>([]);
  const [selectedRunner, setSelectedRunner] = useState<string>('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [loadingRunners, setLoadingRunners] = useState(false);
  const [runnersError, setRunnersError] = useState<string | null>(null);
  // Removed waitForStatusConfirmation polling - WebSocket will handle real-time updates
  // WebSocket subscription in useShopOrders will update cache automatically
  // No need for polling confirmation - trust WebSocket!
  
  // Reset all state when order changes (e.g., modal reopened with updated order)
  useEffect(() => {
    console.log('🔄 UpdateStatusModal: Order changed, resetting state', { orderId: order.id, status: order.status });
    // Force reset loading state to ensure handlers can be called again
    setLoading(false);
    setSelectedRunner('');
    setCancelReason('');
    setShowCancelForm(false);
    setRunnersError(null);
    // Don't clear runners here - let the status-based effect handle it
  }, [order.id, order.status]);
  
  // Additional safety: Reset loading state when modal is opened/closed
  useEffect(() => {
    // This ensures loading is always false when modal is first opened
    setLoading(false);
  }, [order.id]);
  
  // Reset loading state if auth/merchant becomes not ready (e.g., on new tab before hydration)
  useEffect(() => {
    if (!isReady && loading) {
      console.warn('UpdateStatusModal: Auth/merchant became not ready, resetting loading state');
      setLoading(false);
    }
  }, [isReady, loading]);

  // Prefetch runners early - when order is pending or confirmed (not just confirmed)
  // This ensures runners are ready when modal opens for confirmed orders
  const shouldPrefetchRunners = (order.status === 'pending' || order.status === 'confirmed') && !!shopId;
  
  // Use React Query to share cache with DeliveryRunnersPage
  // React Query automatically uses cached data if available (same query key)
  // Prefetch when order is pending so runners are ready when status becomes confirmed
  const { data: cachedRunnersRaw = [], isLoading: loadingRunnersQuery } = useQuery(
    ['delivery-runners', shopId],
    async () => {
      if (!shopId) return [];
      
      // Ultra-fast direct query - minimal fields, no ordering, very short timeout
      console.log('⚡ UpdateStatusModal: Fetching runners (fast query)');
      const queryPromise = supabase
        .from('delivery_runners')
        .select('id, shop_id, name, phone_number, created_at, updated_at')
        .eq('shop_id', shopId)
        .limit(30); // Smaller limit for faster response

      // Very short timeout - fail fast and use cache if available
      const timeoutPromise = new Promise<{ data: any[]; error: null }>((resolve) => {
        setTimeout(() => {
          resolve({ data: [], error: null });
        }, 800); // Reduced to 800ms for ultra-fast response
      });

      const result: any = await Promise.race([queryPromise, timeoutPromise]);
      
      if (result.error && result.error.code !== 'TIMEOUT') {
        console.error('[UpdateStatusModal] Query error:', result.error);
        return [];
      }

      const runnersData = (result.data || []) as Array<{
        id: string;
        shop_id: string;
        name: string;
        phone_number: string;
        created_at: string;
        updated_at: string;
      }>;
      
      // Sort in memory (same as DeliveryRunnersPage)
      return runnersData.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    {
      enabled: shouldPrefetchRunners, // Prefetch when pending or confirmed
      staleTime: 120000, // Cache for 2 minutes (longer cache for stability)
      gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
      retry: 0, // Don't retry on failure - use cache if available
      refetchOnWindowFocus: false,
      // Use stale cache immediately while refetching in background
      refetchOnMount: false, // Don't refetch on mount if cache exists
    }
  );

  // Map cached runners to DeliveryRunnerWithStatus format
  const cachedRunners = useMemo(() => {
    return cachedRunnersRaw.map(r => ({
      id: r.id,
      shop_id: r.shop_id,
      name: r.name,
      phone_number: r.phone_number,
      is_available: true, // All available
      current_order_id: undefined,
      current_order_number: undefined,
    }));
  }, [cachedRunnersRaw]);

  // Update local state when query data changes
  // Use refs to prevent infinite loops from array reference changes
  const prevCachedRunnersRef = useRef<string>('');
  const prevStatusRef = useRef<string>('');
  
  useEffect(() => {
    const currentRunnersKey = JSON.stringify(cachedRunners.map(r => r.id));
    const currentStatus = order.status;
    
    // Only update if runners data or status actually changed
    if (prevCachedRunnersRef.current === currentRunnersKey && prevStatusRef.current === currentStatus) {
      return; // No change, skip update
    }
    
    prevCachedRunnersRef.current = currentRunnersKey;
    prevStatusRef.current = currentStatus;
    
    if (order.status === 'confirmed' && shopId) {
      if (cachedRunners.length > 0) {
        // Runners available - use them immediately
        setRunners(cachedRunners);
        setRunnersError(null);
        setLoadingRunners(false);
        console.log('✅ UpdateStatusModal: Runners loaded instantly from cache:', cachedRunners.length);
      } else if (!loadingRunnersQuery) {
        // Query finished but no runners found
        setRunners([]);
        setRunnersError('No delivery runners found. Please add runners in the Delivery settings first.');
        setLoadingRunners(false);
      } else {
        // Still loading - try to use stale cache from React Query
        setLoadingRunners(true);
        const staleData = queryClient.getQueryData(['delivery-runners', shopId]) as any[];
        if (staleData && staleData.length > 0) {
          console.log('⚡ UpdateStatusModal: Using stale cache while loading fresh data');
          setRunners(staleData.map(r => ({
            id: r.id,
            shop_id: r.shop_id,
            name: r.name,
            phone_number: r.phone_number,
            is_available: true,
            current_order_id: undefined,
            current_order_number: undefined,
          })));
          setRunnersError(null);
          setLoadingRunners(false);
        }
      }
    } else {
      // Clear runners if order is not confirmed
      setRunners([]);
      setRunnersError(null);
      setLoadingRunners(false);
    }
  }, [cachedRunners, loadingRunnersQuery, order.status, shopId]);

  const handleConfirm = async () => {
    if (loading) {
      console.warn('UpdateStatusModal: Handler already in progress, ignoring duplicate call');
      return;
    }
    
    if (!isReady) {
      console.warn('UpdateStatusModal: auth/merchant not ready yet, ignoring confirm click');
      return;
    }
    
    console.log('🔵 UpdateStatusModal: handleConfirm called for order:', order.id);
    setLoading(true);
    
    try {
      // Database update - WebSocket will automatically update UI
      const result = await confirmOrder(order.id);
      
      if (!result.success) {
        console.error('❌ UpdateStatusModal: Order confirmation failed:', result.message);
        setLoading(false);
        return; // Keep modal open for retry
      }
      
      console.log('✅ UpdateStatusModal: Order confirmed, WebSocket will update UI');
      setLoading(false);
      setTimeout(() => {
        onClose(); // WebSocket will update the order status in real-time
      }, 0);
    } catch (error: any) {
      console.error('❌ UpdateStatusModal: Error confirming order:', error);
      setLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (loading) {
      console.warn('UpdateStatusModal: Handler already in progress, ignoring duplicate call');
      return;
    }
    
    if (!isReady) {
      console.warn('UpdateStatusModal: auth/merchant not ready yet, ignoring dispatch click');
      return;
    }
    
    if (!selectedRunner) {
      alert('Please select a delivery runner');
      return;
    }
    
    console.log('🔵 UpdateStatusModal: handleDispatch called for order:', order.id, 'runner:', selectedRunner);
    setLoading(true);
    
    try {
      // Database update - WebSocket will automatically update UI
      const result = await assignRunnerAndDispatch(order.id, selectedRunner);
      
      if (!result.success) {
        console.error('❌ UpdateStatusModal: Order dispatch failed:', result.message);
        setLoading(false);
        return; // Keep modal open for retry
      }
      
      console.log('✅ UpdateStatusModal: Order dispatched, WebSocket will update UI');
      setLoading(false);
      setTimeout(() => {
        onClose(); // WebSocket will update the order status in real-time
      }, 0);
    } catch (error: any) {
      console.error('❌ UpdateStatusModal: Error dispatching order:', error);
      setLoading(false);
    }
  };

  const handleDelivered = async () => {
    if (loading) {
      console.warn('UpdateStatusModal: Handler already in progress, ignoring duplicate call');
      return;
    }
    
    if (!isReady) {
      console.warn('UpdateStatusModal: auth/merchant not ready yet, ignoring delivered click');
      return;
    }
    
    console.log('🔵 UpdateStatusModal: handleDelivered called for order:', order.id);
    setLoading(true);
    
    try {
      // Database update - WebSocket will automatically update UI
      const result = await markOrderDelivered(order.id);
      
      if (!result.success) {
        console.error('❌ UpdateStatusModal: Mark delivered failed:', result.message);
        setLoading(false);
        return; // Keep modal open for retry
      }
      
      console.log('✅ UpdateStatusModal: Order marked as delivered, WebSocket will update UI');
      setLoading(false);
      setTimeout(() => {
        onClose(); // WebSocket will update the order status in real-time
      }, 0);
    } catch (error: any) {
      console.error('❌ UpdateStatusModal: Error marking order as delivered:', error);
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!isReady) {
      console.warn('UpdateStatusModal: auth/merchant not ready yet, ignoring cancel click');
      setLoading(false); // Ensure loading is reset
      return;
    }
    if (!cancelReason.trim()) {
      alert('Please provide a cancellation reason');
      return;
    }
    console.log('🔵 UpdateStatusModal: handleCancel called for order:', order.id, 'reason:', cancelReason);
    setLoading(true);
    try {
      const result = await cancelOrder(order.id, cancelReason);
      console.log('📡 UpdateStatusModal: cancelOrder result:', result);
      if (result.success) {
        console.log('✅ UpdateStatusModal: Order cancelled successfully, calling onSuccess');
        try {
          await onSuccess();
          console.log('✅ UpdateStatusModal: onSuccess completed successfully');
          // Reset loading after onSuccess completes
          setLoading(false);
          // Close modal for cancelled status (terminal state)
          onClose();
        } catch (onSuccessError) {
          console.error('❌ UpdateStatusModal: Error in onSuccess callback:', onSuccessError);
          // If onSuccess fails, we still need to close the modal and reset loading
          setLoading(false);
          onClose();
        }
      } else {
        console.error('❌ UpdateStatusModal: Order cancellation failed:', result.message);
        setLoading(false);
        // Don't show alert - just log and keep modal open for retry
      }
    } catch (error: any) {
      console.error('❌ UpdateStatusModal: Error cancelling order:', error);
      setLoading(false);
      // Don't show alert - just log and keep modal open for retry
    }
  };

  const formatStatus = (status: string) =>
    status
      .replace(/_/g, ' ')
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Update Order Status</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-1">
              Order #{order.order_number || order.id.slice(0, 8).toUpperCase()}
            </p>
            <p className="text-lg font-semibold text-gray-900">Current Status: {formatStatus(order.status)}</p>
            {!isReady && (
              <p className="mt-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1 inline-block">
                Connecting your merchant account... Please wait a moment before updating the status.
              </p>
            )}
          </div>

          {order.status === 'pending' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Confirm this order to start preparation.</p>
              <button
                onClick={handleConfirm}
                disabled={loading || !isReady}
                className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Confirming...' : !isReady ? 'Preparing account...' : 'Confirm Order'}
              </button>
              <button
                onClick={() => setShowCancelForm(true)}
                disabled={loading || !isReady}
                className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel Order
              </button>
            </div>
          )}

          {order.status === 'confirmed' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Assign a delivery runner and mark as out for delivery.</p>
              {loadingRunners ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Loading runners...</span>
                </div>
              ) : runnersError ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{runnersError}</p>
                  <button
                    onClick={async () => {
                      setLoadingRunners(true);
                      setRunnersError(null);
                      try {
                        const runnersList = await getDeliveryRunnersWithStatus(shopId);
                        setRunners(runnersList);
                        if (runnersList.length === 0) {
                          setRunnersError('No delivery runners found. Please add runners first.');
                        }
                      } catch (error) {
                        setRunnersError('Failed to load delivery runners. Please try again.');
                        setRunners([]);
                      } finally {
                        setLoadingRunners(false);
                      }
                    }}
                    className="mt-2 text-sm text-red-600 underline hover:text-red-700"
                  >
                    Retry
                  </button>
                </div>
              ) : runners.length > 0 ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Delivery Runner
                    </label>
                    <select
                      value={selectedRunner}
                      onChange={(e) => setSelectedRunner(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a runner...</option>
                      {runners.map((runner) => (
                        <option
                          key={runner.id}
                          value={runner.id}
                          disabled={!runner.is_available}
                        >
                          {runner.name} {runner.is_available ? '(Available)' : '(Busy)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleDispatch}
                    disabled={loading || !selectedRunner || !isReady}
                    className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Dispatching...' : !isReady ? 'Preparing account...' : 'Mark Out for Delivery'}
                  </button>
                </>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">No delivery runners available. Please add runners first.</p>
                </div>
              )}
            </div>
          )}

          {order.status === 'out_for_delivery' && (
            <div className="space-y-4">
              {order.delivery_runner ? (
                <p className="text-sm text-gray-600">
                  Delivery runner: <span className="font-medium text-gray-900">{order.delivery_runner.name || 'Assigned'}</span>
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  This order is out for delivery, but no runner details are available.
                </p>
              )}

              <p className="text-sm text-gray-600">
                Mark this order as delivered when the customer receives it.
              </p>
              <button
                onClick={handleDelivered}
                disabled={loading || !isReady}
                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : !isReady ? 'Preparing account...' : 'Mark as Delivered'}
              </button>
            </div>
          )}

          {showCancelForm && (
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cancellation Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason for cancellation..."
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={loading || !cancelReason.trim() || !isReady}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Cancelling...' : !isReady ? 'Preparing account...' : 'Confirm Cancellation'}
                </button>
                <button
                  onClick={() => {
                    setShowCancelForm(false);
                    setCancelReason('');
                  }}
                  disabled={loading || !isReady}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Shop Analytics Screen Component
function ShopAnalyticsScreen({ analytics, loading }: { analytics: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <LoadingSpinner text="Loading analytics..." />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        <p className="text-gray-500 text-center">No analytics data available</p>
      </div>
    );
  }

  const formatCurrency = (amount?: number | null) => {
    const value = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
    return `Rs ${value.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return Number.isNaN(date.getTime())
      ? '--'
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatMonth = (monthString?: string | null) => {
    if (!monthString) return '--';
    const [year, month] = monthString.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
    return Number.isNaN(date.getTime())
      ? '--'
      : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.totalRevenue)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">💰</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-gray-900">{analytics.totalOrders}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📦</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm mb-1">Today's Revenue</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.todayRevenue)}</p>
              <p className="text-xs text-gray-500 mt-1">{analytics.todayOrders} orders</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📈</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm mb-1">Avg Order Value</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(analytics.averageOrderValue)}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">This Month</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Revenue</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(analytics.thisMonthRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Orders</span>
              <span className="text-xl font-bold text-gray-900">{analytics.thisMonthOrders}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Last Month</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Revenue</span>
              <span className="text-xl font-bold text-gray-900">{formatCurrency(analytics.lastMonthRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Orders</span>
              <span className="text-xl font-bold text-gray-900">{analytics.lastMonthOrders}</span>
            </div>
            {analytics.lastMonthRevenue > 0 && (
              <div className="pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-500">
                  {analytics.thisMonthRevenue > analytics.lastMonthRevenue ? '↑' : '↓'}{' '}
                  {Math.abs(
                    ((analytics.thisMonthRevenue - analytics.lastMonthRevenue) / analytics.lastMonthRevenue) * 100
                  ).toFixed(1)}% vs last month
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Daily Revenue Chart */}
      {analytics.dailyRevenue && analytics.dailyRevenue.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Revenue (Last 30 Days)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {analytics.dailyRevenue.map((day: any, index: number) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600">{formatDate(day.date)}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">{day.order_count} orders</span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(day.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Revenue Chart */}
      {analytics.monthlyRevenue && analytics.monthlyRevenue.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue (Last 12 Months)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {analytics.monthlyRevenue.map((month: any, index: number) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-600">{formatMonth(month.month)}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">{month.order_count} orders</span>
                  <span className="text-sm font-semibold text-gray-900">{formatCurrency(month.revenue)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Status Breakdown */}
      {analytics.statusBreakdown && analytics.statusBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {analytics.statusBreakdown.map((status: any, index: number) => (
              <div key={index} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{status.count}</p>
                <p className="text-sm text-gray-600 capitalize mt-1">{status.status}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

