import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import ShopCard from '../components/ShopCard';
import LoadingSpinner from '../components/LoadingSpinner';
import ShopCardSkeleton from '../components/skeletons/ShopCardSkeleton';
import { useShopsByLocation } from '../../../src/hooks/consumer/useShopsByLocation';
import AddressMapModal from '../components/consumer/AddressMapModal';
import { useLocationSelection } from '../../../src/context/LocationContext';
import { useOrderApproval } from '../context/OrderApprovalContext';

export default function HomeScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { shops, loading: shopsLoading, error: shopsError, refetch } = useShopsByLocation();
  const { selectedAddress, setSelectedAddress } = useLocationSelection();
  const { activeOrder } = useOrderApproval();
  const [query, setQuery] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const prevActiveOrderRef = useRef<string | null>(null);
  
  // Track previous pathname to detect navigation to home
  const prevPathnameRef = useRef<string>(location.pathname);
  
  // Refetch shops when navigating to home or when active order becomes null (order completed)
  useEffect(() => {
    const currentOrderId = activeOrder?.id || null;
    const prevOrderId = prevActiveOrderRef.current;
    const currentPathname = location.pathname;
    const prevPathname = prevPathnameRef.current;
    
    // Detect navigation to home page
    const navigatedToHome = currentPathname === '/home' && prevPathname !== '/home';
    
    // If we had an active order and now we don't (order completed), refetch shops immediately
    if (prevOrderId && !currentOrderId) {
      console.log('🔄 Order completed, refetching shops immediately...');
      refetch();
    }
    
    // If navigating to home page, refetch shops immediately (fast fetch)
    if (navigatedToHome) {
      console.log('🔄 Navigated to home page, refetching shops immediately...');
      refetch();
    }
    
    // Also refetch when on home page with no shops (fallback)
    if (currentPathname === '/home' && shops.length === 0 && !shopsLoading && !navigatedToHome) {
      console.log('🔄 On home page with no shops, refetching...');
      refetch();
    }
    
    prevActiveOrderRef.current = currentOrderId;
    prevPathnameRef.current = currentPathname;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrder?.id, location.pathname, shops.length, shopsLoading]);

  const filteredShops = useMemo(() => {
    if (!query.trim()) return shops;
    const lower = query.toLowerCase();
    return shops.filter((shop) =>
      [shop.name, shop.address]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(lower))
    );
  }, [shops, query]);

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      {/* Search Bar */}
      <div className="bg-white border-b border-gray-100 py-3 sm:py-4 md:py-5 shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-3xl flex flex-row items-center bg-gray-50 rounded-lg sm:rounded-xl px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3.5 border border-gray-200 focus-within:border-blue-400 focus-within:bg-white transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <span className="text-gray-400 text-lg sm:text-xl mr-2 sm:mr-3 flex-shrink-0">🔍</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shops or products…"
              className="flex-1 bg-transparent text-sm sm:text-base text-gray-800 placeholder-gray-400 outline-none border-none"
            />
            {query && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setQuery('')}
                className="ml-3 text-gray-400 hover:text-gray-600 transition-colors text-lg"
              >
                ✕
              </motion.button>
            )}
          </motion.div>
          {query && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 text-xs text-gray-500"
            >
              Showing results for <span className="font-semibold text-gray-700">"{query.trim()}"</span>
            </motion.p>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6">
        {/* Promotional Banner/Carousel Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 sm:mb-8"
        >
          <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 rounded-xl sm:rounded-2xl p-6 sm:p-8 md:p-10 lg:p-12 text-white shadow-xl overflow-hidden relative">
            <div className="relative z-10">
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold mb-2 sm:mb-3 leading-tight">
                Order anything Online from Local Shops
              </h2>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-blue-50 font-medium">
                Fast delivery • Local shops • Best offers
              </p>
            </div>
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full -ml-24 -mb-24" />
          </div>
        </motion.div>

        {/* Nearby Shops Section */}
        <div className="space-y-6 sm:space-y-8">
          <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-start">
            <div className="flex-1 min-w-0 space-y-4 sm:space-y-6">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-1">Nearby Shops</h2>
                  {shops.length > 0 && (
                    <p className="text-gray-500 text-xs sm:text-sm font-medium">
                      {shops.length} {shops.length === 1 ? 'shop' : 'shops'} available in your area
                    </p>
                  )}
                </div>
              </div>

              {/* Loading State */}
              {shopsLoading && (
                <div className="fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6">
                    {[...Array(6)].map((_, i) => (
                      <ShopCardSkeleton key={i} />
                    ))}
                  </div>
                  <div className="py-8 flex items-center justify-center">
                    <LoadingSpinner size="sm" text="Finding shops near you..." />
                  </div>
                </div>
              )}

              {/* Error State */}
              {!shopsLoading && shopsError && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 flex items-center justify-center flex-col bg-white rounded-xl shadow-sm border border-red-200"
                >
                  <p className="text-red-600 text-center font-semibold mb-2 text-lg">{shopsError}</p>
                  {shopsError.includes('Supabase') || shopsError.includes('configuration') || shopsError.includes('network') ? (
                    <p className="text-gray-600 text-sm text-center mt-2 max-w-md">
                      Please check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly.
                    </p>
                  ) : null}
                </motion.div>
              )}

              {/* Empty State */}
              {!shopsLoading && !shopsError && shops.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-12 flex items-center justify-center flex-col bg-white rounded-xl shadow-sm"
                >
                  <span className="text-6xl mb-4">🏪</span>
                  <p className="text-gray-600 text-center text-lg max-w-md">
                    No shops found in your delivery area. Try selecting a different address.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowAddressModal(true)}
                    className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
                  >
                    Change Location
                  </motion.button>
                </motion.div>
              )}

              {/* Shop Cards Grid */}
              {!shopsLoading && !shopsError && filteredShops.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 lg:gap-8">
                  {filteredShops.map((shop, index) => (
                    <motion.div
                      key={shop.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <ShopCard
                        shop={shop}
                        onPress={() => navigate(`/shop/${shop.id}`, { state: { shop } })}
                      />
                    </motion.div>
                  ))}
                </div>
              )}

              {!shopsLoading && !shopsError && filteredShops.length === 0 && shops.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-12 flex items-center justify-center flex-col bg-white rounded-xl shadow-sm"
                >
                  <span className="text-6xl mb-4">🔍</span>
                  <p className="text-gray-600 text-center text-lg max-w-md">
                    No shops match <span className="font-semibold">"{query.trim()}"</span>. Try a different search term.
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Address Map Modal */}
      <AddressMapModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onUseLocation={(address) => {
          setSelectedAddress({
            label: address.label,
            city: address.city,
            coords: address.coords,
            isCurrent: false,
          });
          setShowAddressModal(false);
        }}
        showSaveOption={false}
        initialAddress={selectedAddress?.label}
        initialLatitude={selectedAddress?.coords?.latitude}
        initialLongitude={selectedAddress?.coords?.longitude}
      />
    </div>
  );
}

