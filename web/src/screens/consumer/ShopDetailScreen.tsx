import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { fetchShopDetails, fetchShopCategories, fetchShopItems, ShopCategory, ShopItem } from '../../../../src/services/consumer/shopService';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useCart } from '../../../../src/context/CartContext';
import { useCartStore } from '../../../../src/stores/cartStore';
import { useUserLocation } from '../../../../src/hooks/consumer/useUserLocation';
import { useLocationSelection } from '../../../../src/context/LocationContext';
import { calculateShopDeliveryFee } from '../../../../src/services/consumer/deliveryFeeService';
import ShopRating from '../../components/ShopRating';

export default function ShopDetailScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { shopId } = useParams<{ shopId: string }>();
  const shopFromState = (location.state as any)?.shop;

  const [shop, setShop] = useState<any>(shopFromState || null);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [allItems, setAllItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [loadingDeliveryFee, setLoadingDeliveryFee] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState<number>(0);
  const { addItem, removeItem, updateQuantity, getShopCart } = useCart();
  const { coords } = useUserLocation();
  const { selectedAddress } = useLocationSelection();
  const actualShopId = shopId || shopFromState?.id;
  
  // Use Zustand selector directly for real-time updates without context overhead
  const getItemQuantity = useCartStore((state) => state.getItemQuantity);
  
  // Check if this shop has items in cart
  const shopCart = actualShopId ? getShopCart(actualShopId) : null;
  const hasItemsInCart = shopCart && shopCart.items.length > 0;
  
  // Refs for category sections to enable scrolling
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  
  // Memoize quantity lookups for each item to prevent unnecessary recalculations
  const getItemQty = useMemo(() => {
    if (!actualShopId) return () => 0;
    return (itemId: string) => getItemQuantity(actualShopId, itemId);
  }, [actualShopId, getItemQuantity]);

  // Fetch shop details
  useEffect(() => {
    if (!actualShopId && !shopFromState) {
      setError('Shop ID is required');
      setLoading(false);
      return;
    }

    const loadShopData = async () => {
      setLoading(true);
      setError(null);

      try {
        // If shop is passed from state, use it; otherwise fetch
        if (shopFromState) {
          setShop(shopFromState);
        } else if (actualShopId) {
          const { data: shopData, error: shopError } = await fetchShopDetails(actualShopId);
          if (shopError || !shopData) {
            setError('Failed to load shop details');
            setLoading(false);
            return;
          }
          setShop(shopData);
        }

        // Fetch categories and items in parallel
        const [categoriesResult, itemsResult] = await Promise.all([
          fetchShopCategories(actualShopId!),
          fetchShopItems(actualShopId!, undefined, undefined) // Get all items
        ]);

        if (categoriesResult.error) {
          console.error('Error fetching categories:', categoriesResult.error);
        } else {
          setCategories(categoriesResult.data || []);
        }

        if (itemsResult.error) {
          console.error('Error fetching items:', itemsResult.error);
          setError('Failed to load shop items');
        } else {
          setAllItems(itemsResult.data || []);
        }

        // No reviews table exists yet, so show empty state
        // TODO: Implement reviews table and fetch real reviews from Supabase
        setReviews([]);
        setAverageRating(0);
      } catch (err: any) {
        console.error('Error loading shop data:', err);
        setError(err.message || 'Failed to load shop data');
      } finally {
        setLoading(false);
      }
    };

    loadShopData();
  }, [actualShopId, shopFromState]);

  // Calculate delivery fee based on user location
  useEffect(() => {
    const calculateFee = async () => {
      if (!shop || !shop.latitude || !shop.longitude) {
        setLoadingDeliveryFee(false);
        return;
      }

      // Get user location from selected address or current location
      let userLat: number | null = null;
      let userLng: number | null = null;

      if (selectedAddress?.coords?.latitude && selectedAddress?.coords?.longitude) {
        userLat = selectedAddress.coords.latitude;
        userLng = selectedAddress.coords.longitude;
      } else if (coords?.latitude && coords?.longitude) {
        userLat = coords.latitude;
        userLng = coords.longitude;
      }

      if (!userLat || !userLng) {
        setLoadingDeliveryFee(false);
        return;
      }

      try {
        setLoadingDeliveryFee(true);
        const fee = await calculateShopDeliveryFee(
          {
            id: shop.id,
            name: shop.name,
            latitude: shop.latitude,
            longitude: shop.longitude,
          } as any,
          userLat,
          userLng
        );
        setDeliveryFee(fee);
      } catch (err) {
        console.error('Error calculating delivery fee:', err);
        // Fallback to max delivery fee
        setDeliveryFee(shop?.deliveryLogic?.maxDeliveryFee || 0);
      } finally {
        setLoadingDeliveryFee(false);
      }
    };

    calculateFee();
  }, [shop, selectedAddress, coords]);

  // Group items by category
  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, ShopItem[]> = {};
    const uncategorized: ShopItem[] = [];

    allItems.forEach((item) => {
      if (item.categories && item.categories.length > 0) {
        item.categories.forEach((categoryId) => {
          if (!grouped[categoryId]) {
            grouped[categoryId] = [];
          }
          // Avoid duplicates
          if (!grouped[categoryId].find(i => i.id === item.id)) {
            grouped[categoryId].push(item);
          }
        });
      } else {
        uncategorized.push(item);
      }
    });

    // If there are uncategorized items, add them to a special group
    if (uncategorized.length > 0) {
      grouped['uncategorized'] = uncategorized;
    }

    return grouped;
  }, [allItems]);

  // Filter items based on search query
  const filteredItemsByCategory = useMemo(() => {
    if (!searchQuery.trim()) {
      return itemsByCategory;
    }

    const filtered: Record<string, ShopItem[]> = {};
    const query = searchQuery.toLowerCase().trim();

    Object.keys(itemsByCategory).forEach((categoryId) => {
      const filteredItems = itemsByCategory[categoryId].filter((item) =>
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
      );
      if (filteredItems.length > 0) {
        filtered[categoryId] = filteredItems;
      }
    });

    return filtered;
  }, [itemsByCategory, searchQuery]);

  // Get category name by ID
  const getCategoryName = (categoryId: string): string => {
    if (categoryId === 'uncategorized') {
      return 'Uncategorized';
    }
    const category = categories.find((cat) => cat.id === categoryId);
    return category?.name || 'Unknown Category';
  };

  // Always show all items (no filtering) - just for navigation/highlighting
  const displayItemsByCategory = filteredItemsByCategory;

  // Scroll to category section (navigation only, no filtering)
  const scrollToCategory = (categoryId: string | null) => {
    console.log('[scrollToCategory] Called with categoryId:', categoryId);
    
    if (categoryId === null) {
      // Scroll to top of products section
      const productsSection = document.querySelector('.products-content');
      if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setSelectedCategory(null);
      return;
    }

    // Highlight the category in sidebar first
    setSelectedCategory(categoryId);
    console.log('[scrollToCategory] Category highlighted, looking for element...');

    // Function to perform the scroll
    const performScroll = (element: HTMLElement) => {
      console.log('[scrollToCategory] Scrolling to category:', categoryId);
      console.log('[scrollToCategory] Element:', element);

      // Calculate offset to account for sticky header and search bar
      const headerOffset = 200; // Approximate height of sticky elements
      
      // Get current scroll position
      const currentScroll = window.pageYOffset || document.documentElement.scrollTop || window.scrollY;
      
      // Get element position relative to document
      const rect = element.getBoundingClientRect();
      const elementTop = rect.top + currentScroll;
      
      // Calculate target scroll position with offset
      const targetScroll = Math.max(0, elementTop - headerOffset);

      console.log('[scrollToCategory] Current scroll:', currentScroll);
      console.log('[scrollToCategory] Element top (relative to document):', elementTop);
      console.log('[scrollToCategory] Target scroll:', targetScroll);

      // Try multiple scroll methods for better compatibility
      // Method 1: Use scrollIntoView first (most reliable)
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Then adjust for header offset after a short delay
      setTimeout(() => {
        const currentAfterScroll = window.pageYOffset || document.documentElement.scrollTop || window.scrollY;
        const adjustedScroll = currentAfterScroll - headerOffset;
        console.log('[scrollToCategory] After scrollIntoView, current scroll:', currentAfterScroll);
        console.log('[scrollToCategory] Adjusting by -', headerOffset, 'to:', adjustedScroll);
        
        // Scroll back up by the header offset
        window.scrollTo({
          top: Math.max(0, adjustedScroll),
          behavior: 'smooth'
        });
      }, 300); // Wait for scrollIntoView to complete
    };

    // Try multiple methods to find the element
    const findAndScroll = () => {
      // Method 1: Try ref first
      let element: HTMLElement | null = categoryRefs.current[categoryId];
      console.log('[scrollToCategory] Method 1 (ref):', element ? 'Found' : 'Not found');
      
      // Method 2: Try by ID if ref not available
      if (!element) {
        element = document.getElementById(`category-${categoryId}`);
        console.log('[scrollToCategory] Method 2 (getElementById):', element ? 'Found' : 'Not found');
      }
      
      // Method 3: Try querySelector as fallback
      if (!element) {
        element = document.querySelector(`#category-${categoryId}`) as HTMLElement | null;
        console.log('[scrollToCategory] Method 3 (querySelector):', element ? 'Found' : 'Not found');
      }
      
      // Method 4: Try data attribute as last resort
      if (!element) {
        element = document.querySelector(`[data-category-id="${categoryId}"]`) as HTMLElement | null;
        console.log('[scrollToCategory] Method 4 (data attribute):', element ? 'Found' : 'Not found');
      }

      if (element) {
        console.log('[scrollToCategory] Element found, performing scroll');
        console.log('[scrollToCategory] Available refs:', Object.keys(categoryRefs.current));
        performScroll(element);
        return true;
      }
      console.log('[scrollToCategory] Element not found for category:', categoryId);
      console.log('[scrollToCategory] Available refs:', Object.keys(categoryRefs.current));
      console.log('[scrollToCategory] All category IDs in DOM:', Array.from(document.querySelectorAll('[data-category-id]')).map(el => el.getAttribute('data-category-id')));
      return false;
    };

    // Try immediately
    if (!findAndScroll()) {
      console.log('[scrollToCategory] Element not found immediately, retrying...');
      // If not found, try with a small delay (element might not be rendered yet)
      setTimeout(() => {
        if (!findAndScroll()) {
          console.log('[scrollToCategory] Still not found, retrying one more time...');
          // Try one more time with longer delay
          setTimeout(() => {
            findAndScroll();
          }, 300);
        }
      }, 150);
    }
  };

  // Calculate delivery info from shop delivery logic
  const minOrder = shop?.deliveryLogic?.minimumOrderValue || 250;
  const leastOrder = shop?.deliveryLogic?.leastOrderValue || 120;
  const freeDeliveryThreshold = shop?.deliveryLogic?.freeDeliveryThreshold || 1000;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading shop..." />
      </div>
    );
  }

  if (error || !shop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <span className="text-6xl mb-4 block">😕</span>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Shop Not Found</h2>
          <p className="text-gray-600 mb-6">{error || 'The shop you are looking for does not exist.'}</p>
          <button
            onClick={() => navigate('/home')}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  const activeCategories = categories.filter((cat) => cat.is_active);
  const shopImageUrl = shop.image_url || '';

  return (
    <>
      <style>{`
        .category-tabs::-webkit-scrollbar,
        .product-scroll::-webkit-scrollbar {
          display: none;
        }
        .category-tabs,
        .product-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 relative">
        {/* Right Edge Hover Area - Opens Cart */}
        {hasItemsInCart && actualShopId && (
          <div
            className="fixed right-0 top-0 h-full w-6 z-30 hover:w-10 transition-all duration-300 ease-out group cursor-pointer"
            onMouseEnter={() => {
              // Dispatch custom event to open cart for this shop
              window.dispatchEvent(new CustomEvent('openShopCart', {
                detail: { shopId: actualShopId }
              }));
            }}
            style={{ 
              pointerEvents: 'auto',
              // Only show when not overlapping with side cart (side cart is max-w-md = 448px)
              // This ensures it doesn't interfere when cart is open
            }}
          >
            {/* Visual indicator on hover */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-24 bg-blue-600 rounded-l-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg" />
            {/* Tooltip */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap shadow-lg z-50">
              Open Cart
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-blue-600" />
            </div>
          </div>
        )}
        
        {/* Store Banner */}
      <div className="relative w-full h-32 sm:h-36 md:h-40 lg:h-48 overflow-hidden">
        {shopImageUrl ? (
          <img
            src={shopImageUrl}
            alt={shop.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-900 flex items-center justify-center">
            <span className="text-white text-4xl">🏪</span>
          </div>
        )}
        
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-100 transition-colors z-10"
        >
          <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Store Name and Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 text-white">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-1 drop-shadow-lg truncate">{shop.name}</h1>
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <ShopRating shopId={shop.id} highlighted />
              {shop.orders && (
                <span className="font-medium text-xs sm:text-sm">• {shop.orders} orders</span>
              )}
            </div>
          </div>
        </div>

        {/* Store Type Badge */}
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
          <span className="text-gray-800 font-semibold text-xs uppercase tracking-wide">
            {shop.tags?.[0] || 'STORE'}
          </span>
        </div>
      </div>

      {/* Service Information Cards */}
        <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-5 md:py-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
            {/* Delivery Fee */}
            <div className="bg-blue-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Delivery</p>
                <p className="text-xs sm:text-sm font-bold text-blue-600 truncate">
                  {loadingDeliveryFee ? '...' : `Rs ${deliveryFee.toFixed(0)}`}
                </p>
              </div>
            </div>

            {/* Min Order */}
            <div className="bg-green-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Min Order</p>
                <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">Rs {minOrder}</p>
              </div>
            </div>

            {/* Starts At */}
            <div className="bg-yellow-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Starts at</p>
                <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">Rs {leastOrder}</p>
              </div>
            </div>

            {/* Free Delivery */}
            <div className="bg-pink-50 rounded-lg sm:rounded-xl p-2.5 sm:p-3 md:p-4 flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Free Delivery</p>
                <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">On Rs {freeDeliveryThreshold}+</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar - Always Sticky */}
      <div className="bg-white border-b border-gray-200 sticky top-14 sm:top-16 md:top-[56px] z-40 shadow-md transition-all duration-300 ease-in-out">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          <div className="relative max-w-full sm:max-w-sm pr-3 sm:pr-4">
            <input
              type="text"
              placeholder="Search for items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 pl-10 sm:pl-12 pr-10 sm:pr-12 bg-white border border-gray-300 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ease-in-out hover:border-blue-400 text-sm sm:text-base"
            />
            <svg
              className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-all duration-200 hover:scale-110"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area with Sidebar */}
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 pt-4 sm:pt-5 md:pt-6">
        {/* Tablet/Mobile: Horizontal Scroll Menu - Above products */}
        {activeCategories.length > 0 && (
          <div className="lg:hidden w-full mb-4 pt-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
              <h3 className="font-bold text-gray-900 text-base mb-3">Categories</h3>
              <div className="flex gap-2 overflow-x-auto pb-2 category-tabs">
                {activeCategories.map((category) => {
                  const itemCount = itemsByCategory[category.id]?.length || 0;
                  if (itemCount === 0) return null;
                  const isSelected = selectedCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => scrollToCategory(category.id)}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span className="text-sm whitespace-nowrap">{category.name}</span>
                      <span className={`text-xs ml-2 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                        ({itemCount})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Desktop: Side-by-side layout - Perfect alignment */}
        <div className="flex gap-6 w-full">
          {/* Categories Sidebar - Fixed width, sticky */}
          {activeCategories.length > 0 && (
            <div className="hidden lg:block w-[300px] flex-shrink-0">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 sticky top-[100px] z-30 max-h-[calc(100vh-120px)] overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200 flex-shrink-0">
                  <h3 className="font-bold text-gray-900 text-lg">Categories</h3>
                  <p className="text-sm text-gray-600 mt-1">{activeCategories.length} categories</p>
                </div>
                <div className="p-2 overflow-y-auto flex-1">
                  {activeCategories.map((category) => {
                    const itemCount = itemsByCategory[category.id]?.length || 0;
                    if (itemCount === 0) return null;
                    const isSelected = selectedCategory === category.id;
                    return (
                      <button
                        key={category.id}
                        onClick={() => scrollToCategory(category.id)}
                        className={`w-full text-left px-4 py-3 rounded-lg mb-1 transition-all duration-200 ease-in-out ${
                          isSelected
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base truncate">{category.name}</span>
                          <span className={`text-sm flex-shrink-0 ml-2 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                            {itemCount}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Products Content - Starts immediately beside sidebar, perfect top alignment */}
          <div className="flex-1 min-w-0 products-content pt-0">
        {allItems.length === 0 ? (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-8 sm:p-10 md:p-12 text-center">
            <span className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4 block">📦</span>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Items Available</h3>
            <p className="text-sm sm:text-base text-gray-600">This shop doesn't have any items yet.</p>
          </div>
        ) : Object.keys(displayItemsByCategory).length === 0 ? (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-8 sm:p-10 md:p-12 text-center">
            <span className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4 block">🔍</span>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Items Found</h3>
            <p className="text-sm sm:text-base text-gray-600">Try adjusting your search query.</p>
          </div>
        ) : (
          <div className="space-y-8 sm:space-y-10 md:space-y-12">
            {Object.keys(displayItemsByCategory).map((categoryId) => {
              const items = displayItemsByCategory[categoryId];
              if (!items || items.length === 0) return null;

              const categoryName = getCategoryName(categoryId);
              const category = categories.find((cat) => cat.id === categoryId);

              return (
                <div 
                  key={categoryId} 
                  ref={(el) => {
                    if (el) {
                      categoryRefs.current[categoryId] = el;
                    } else {
                      // Clean up if element is removed
                      delete categoryRefs.current[categoryId];
                    }
                  }}
                  className="scroll-mt-32"
                  id={`category-${categoryId}`}
                  data-category-id={categoryId}
                >
                  {/* Category Header - Aligned with sidebar top */}
                  <div className="mb-4">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">{categoryName}</h2>
                  </div>

                  {/* Items Grid - Responsive grid layout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-5 md:gap-6 mb-8 sm:mb-10 md:mb-12">
                    {items.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white border border-gray-200 rounded-lg sm:rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer group"
                          onClick={() => {
                            // Navigate to item detail or add to cart
                            console.log('Item clicked:', item);
                          }}
                        >
                          {/* Item Image */}
                          <div className="w-full h-48 sm:h-52 md:h-56 bg-gray-100 relative overflow-hidden">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-gray-400 text-4xl">📦</span>
                              </div>
                            )}
                            {/* Add Button - Floating on Image */}
                            {actualShopId && getItemQty(item.id) > 0 ? (
                              <div className="absolute bottom-2 right-2 flex items-center gap-2 bg-white rounded-full shadow-lg border-2 border-blue-600 z-10">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addItem({
                                      id: item.id,
                                      shopId: actualShopId!,
                                      shopName: shop.name,
                                      name: item.name,
                                      description: item.description || undefined,
                                      image_url: item.image_url || undefined,
                                      price_cents: item.price_cents,
                                    });
                                  }}
                                  className="w-8 h-8 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-l-full transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                  </svg>
                                </button>
                                <span className="text-sm font-semibold text-gray-900 min-w-[24px] text-center">
                                  {getItemQty(item.id)}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentQty = getItemQty(item.id);
                                    if (currentQty > 1) {
                                      updateQuantity(actualShopId, item.id, currentQty - 1);
                                    } else {
                                      removeItem(actualShopId, item.id);
                                    }
                                  }}
                                  className="w-8 h-8 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-r-full transition-colors"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (actualShopId) {
                                    addItem({
                                      id: item.id,
                                      shopId: actualShopId,
                                      shopName: shop.name,
                                      name: item.name,
                                      description: item.description || undefined,
                                      image_url: item.image_url || undefined,
                                      price_cents: item.price_cents,
                                    });
                                  }
                                }}
                                className="absolute bottom-2 right-2 w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all duration-200 hover:scale-110 z-10"
                                title="Add to cart"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            )}
                          </div>

                          {/* Item Info */}
                          <div className="p-3 sm:p-4">
                            <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-sm sm:text-base leading-tight">{item.name}</h3>
                            <div className="mt-2">
                              <span className="text-base sm:text-lg font-bold text-blue-600">
                                Rs {(item.price_cents / 100).toFixed(0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 md:p-6 mt-4 sm:mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Customer Reviews</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm text-gray-600">Average Rating:</span>
                <div className="flex items-center gap-1">
                  <span className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{averageRating.toFixed(1)}</span>
                  <span className="text-yellow-500 text-lg sm:text-xl">★</span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{review.customer_name}</p>
                      <p className="text-xs text-gray-500">{new Date(review.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-lg ${star <= review.rating ? 'text-yellow-500' : 'text-gray-300'}`}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
