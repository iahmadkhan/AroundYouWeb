import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../../src/context/AuthContext';
import { supabase } from '../../../../src/services/supabase';
import MerchantShopsScreen from './MerchantShopsScreen';
import MerchantOrdersScreen from './MerchantOrdersScreen';
import { useAnalytics } from '../../../../src/hooks/merchant/useAnalytics';
import LoadingSpinner from '../../components/LoadingSpinner';
import SPALayout from '../../components/spa/SPALayout';
import StoreManagementPage from '../../components/spa/StoreManagementPage';
import CategoriesManagementPage from '../../components/spa/CategoriesManagementPage';
import AuditLogPage from '../../components/spa/AuditLogPage';
import DeliveryAreasPage from '../../components/spa/DeliveryAreasPage';
import DeliveryRunnersPage from '../../components/spa/DeliveryRunnersPage';
import DeliveryLogicPage from '../../components/spa/DeliveryLogicPage';
import DistanceTieringPage from '../../components/spa/DistanceTieringPage';
import HelpCenterPage from '../../components/spa/HelpCenterPage';
import LanguageSelectionModal from '../../components/spa/LanguageSelectionModal';
import ContactInfoModal from '../../components/spa/ContactInfoModal';
// Using SPALayout (not SPMLayout)
import { getMerchantShops, type MerchantShop } from '../../../../src/services/merchant/shopService';
import MerchantShopPortalScreen from './shop/MerchantShopPortalScreen';
import DashboardSummary from '../../components/spa/DashboardSummary';
import { useMerchantShops } from '../../../../src/hooks/merchant/useMerchantShops';

export default function MerchantDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const [activeSidebarItem, setActiveSidebarItem] = useState<'shops' | 'dashboard' | 'inventory' | 'orders' | 'analytics' | 'delivery' | 'back-to-consumer' | string>('dashboard');
  const [merchantId, setMerchantId] = useState<string>('');
  const [selectedShopId, setSelectedShopId] = useState<string>('');
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showContactInfoModal, setShowContactInfoModal] = useState(false);
  const { data: analytics, isLoading: analyticsLoading } = useAnalytics(merchantId);
  
  // Use React Query hook for shops with caching
  const { data: shops = [], isLoading: shopsLoading, refetch: refetchShops } = useMerchantShops(user?.id);

  // Restore state from URL params on mount
  useEffect(() => {
    const sidebarItem = searchParams.get('view') || searchParams.get('activeSidebarItem');
    const shopId = searchParams.get('shopId');
    
    if (sidebarItem) {
      setActiveSidebarItem(sidebarItem);
    }
    if (shopId) {
      setSelectedShopId(shopId);
    }

    // Initialize language preference
    const savedLanguage = localStorage.getItem('websiteLanguage') || 'en';
    document.documentElement.lang = savedLanguage;
  }, []); // Only run on mount

  useEffect(() => {
    if (user) {
      loadMerchantId();
    }
  }, [user]);

  // Auto-select first shop when shops load
  useEffect(() => {
    if (shops.length > 0 && !selectedShopId) {
      const shopIdFromUrl = searchParams.get('shopId');
      if (shopIdFromUrl && shops.find(s => s.id === shopIdFromUrl)) {
        setSelectedShopId(shopIdFromUrl);
      } else {
        setSelectedShopId(shops[0].id);
      }
    }
  }, [shops, selectedShopId, searchParams]);

  // Refetch shops when tab regains focus
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        refetchShops();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) {
        refetchShops();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, refetchShops]);

  // Handle navigation state to set active sidebar item
  useEffect(() => {
    const state = location.state as any;
    if (state?.activeSidebarItem) {
      setActiveSidebarItem(state.activeSidebarItem);
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      newParams.set('view', state.activeSidebarItem);
      setSearchParams(newParams, { replace: true });
    }
  }, [location.state, searchParams, setSearchParams]);

  // Update URL params when activeSidebarItem changes (but skip initial mount)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const newParams = new URLSearchParams(searchParams);
    if (activeSidebarItem && activeSidebarItem !== 'dashboard') {
      newParams.set('view', activeSidebarItem);
    } else {
      newParams.delete('view');
    }
    setSearchParams(newParams, { replace: true });
  }, [activeSidebarItem, searchParams, setSearchParams]);

  // Update URL params when selectedShopId changes (but skip initial mount)
  const isInitialShopMount = useRef(true);
  useEffect(() => {
    if (isInitialShopMount.current) {
      isInitialShopMount.current = false;
      return;
    }
    if (selectedShopId) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('shopId', selectedShopId);
      setSearchParams(newParams, { replace: true });
    }
  }, [selectedShopId, searchParams, setSearchParams]);

  const loadMerchantId = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('merchant_accounts')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data && !error) {
        const merchantData = data as { id: string };
        if (merchantData.id) {
          setMerchantId(merchantData.id);
        }
      }
    } catch (err) {
      console.error('Error loading merchant ID:', err);
    }
  };


  const handleSidebarItemClick = (item: string) => {
    console.log('[MerchantDashboard] Sidebar item clicked:', item);
    
    if (item === 'back-to-consumer') {
      console.log('[MerchantDashboard] Switching to consumer side');
      navigate('/home');
      return;
    }

    if (item === 'profile') {
      navigate('/merchantprofile', { state: { from: 'merchant-dashboard' } });
      return;
    }
    
    if (item === 'logout') {
      console.log('[MerchantDashboard] Logging out');
      handleLogout();
      return;
    }

    if (item === 'language') {
      setShowLanguageModal(true);
      return;
    }

    if (item === 'contact-info') {
      setShowContactInfoModal(true);
      return;
    }

    console.log('[MerchantDashboard] Setting active sidebar item to:', item);
    setActiveSidebarItem(item);
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/home');
    } catch (error: any) {
      console.error('[MerchantDashboard] Logout error:', error);
      alert(`Logout Error: ${error?.message || 'Failed to logout. Please try again.'}`);
    }
  };

  const selectedShop = shops.find(shop => shop.id === selectedShopId);

  const renderContent = () => {
    switch (activeSidebarItem) {
      case 'shops':
        return <MerchantShopsScreen onShopSelect={(shopId) => {
          setSelectedShopId(shopId);
          setActiveSidebarItem('dashboard');
        }} />;
      case 'dashboard':
        // Use selectedShop or first shop if available
        const dashboardShop = selectedShop || (shops.length > 0 ? shops[0] : null);
        return dashboardShop ? (
          <DashboardSummary shopId={dashboardShop.id} />
        ) : (
          <div className="p-6">
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 text-lg">No shops available. Create a shop to get started.</p>
            </div>
          </div>
        );
      case 'inventory':
      case 'all-items':
        // Use selectedShop or first shop if available
        const inventoryShop = selectedShop || (shops.length > 0 ? shops[0] : null);
        return <StoreManagementPage shopId={inventoryShop?.id} />;
      case 'categories':
        const categoriesShop = selectedShop || (shops.length > 0 ? shops[0] : null);
        return <CategoriesManagementPage shopId={categoriesShop?.id} />;
      case 'audit-log':
        const auditShop = selectedShop || (shops.length > 0 ? shops[0] : null);
        return <AuditLogPage shopId={auditShop?.id} />;
      case 'orders':
        const ordersShop = selectedShop || (shops.length > 0 ? shops[0] : null);
        return ordersShop ? (
          <MerchantShopPortalScreen 
            shop={ordersShop} 
            activeTab="orders"
            hideTabs={true}
          />
        ) : <MerchantOrdersScreen />;
      case 'analytics':
        const analyticsShop = selectedShop || (shops.length > 0 ? shops[0] : null);
        return analyticsShop ? (
          <MerchantShopPortalScreen 
            shop={analyticsShop} 
            activeTab="analytics"
            hideTabs={true}
          />
        ) : (
          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Analytics</h2>
            {analyticsLoading ? (
              <LoadingSpinner />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-gray-600 text-sm">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${analytics?.totalRevenue?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-gray-600 text-sm">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {analytics?.totalOrders || 0}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow p-4">
                  <p className="text-gray-600 text-sm">Average Order Value</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ${analytics?.averageOrderValue?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      case 'delivery':
      case 'delivery-areas':
      case 'delivery-runners':
      case 'delivery-logic':
      case 'distance-tiering':
        const deliveryShop = selectedShop || (shops.length > 0 ? shops[0] : null);
        if (!deliveryShop) {
          return (
            <div className="p-6">
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-600 text-lg">No shops available. Create a shop to get started.</p>
              </div>
            </div>
          );
        }
        // Handle delivery sub-items
        if (activeSidebarItem === 'delivery-areas') {
          return <DeliveryAreasPage shopId={deliveryShop.id} />;
        }
        if (activeSidebarItem === 'delivery-runners') {
          return <DeliveryRunnersPage shopId={deliveryShop.id} />;
        }
        if (activeSidebarItem === 'delivery-logic') {
          return <DeliveryLogicPage shopId={deliveryShop.id} />;
        }
        if (activeSidebarItem === 'distance-tiering') {
          return <DistanceTieringPage shopId={deliveryShop.id} />;
        }
        // Default delivery view
        return (
          <MerchantShopPortalScreen 
            shop={deliveryShop} 
            activeTab="delivery"
            hideTabs={true}
          />
        );
      case 'help-center':
        return <HelpCenterPage />;
      default:
        return <MerchantShopsScreen onShopSelect={setSelectedShopId} />;
    }
  };

  const shopOptions = shops.map(shop => ({
    id: shop.id,
    name: shop.name,
  }));

  return (
    <SPALayout
      activeSidebarItem={activeSidebarItem}
      onSidebarItemClick={handleSidebarItemClick}
      headerTitle={
        activeSidebarItem === 'dashboard' ? 'Dashboard' :
        activeSidebarItem === 'inventory' ? 'Inventory' :
        activeSidebarItem === 'orders' ? 'Orders' :
        activeSidebarItem === 'analytics' ? 'Analytics' :
        activeSidebarItem === 'delivery' || activeSidebarItem === 'delivery-areas' || activeSidebarItem === 'delivery-runners' || activeSidebarItem === 'delivery-logic' || activeSidebarItem === 'distance-tiering' ? 'Delivery' :
        activeSidebarItem === 'help-center' ? 'Help Center' :
        'Shops'
      }
      shops={activeSidebarItem === 'shops' || activeSidebarItem === 'help-center' ? [] : shopOptions}
      selectedShopId={activeSidebarItem === 'shops' || activeSidebarItem === 'help-center' ? undefined : (selectedShopId || (shops.length > 0 ? shops[0].id : ''))}
      onShopChange={(shopId) => {
        setSelectedShopId(shopId);
      }}
    >
      {renderContent()}
      <LanguageSelectionModal 
        isOpen={showLanguageModal} 
        onClose={() => setShowLanguageModal(false)} 
      />
      <ContactInfoModal 
        isOpen={showContactInfoModal} 
        onClose={() => setShowContactInfoModal(false)} 
      />
    </SPALayout>
  );
}
