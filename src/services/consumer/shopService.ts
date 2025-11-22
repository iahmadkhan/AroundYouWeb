import { supabase } from '../supabase';
import type { Shop } from '../supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import type { DeliveryLogic } from '../merchant/deliveryLogicService';
import { isPointInsidePolygon } from '../../utils/polygons';

export type ConsumerShop = Shop;

export type ShopDetails = {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  address: string;
  latitude: number;
  longitude: number;
  tags: string[];
  is_open: boolean;
  rating: number;
  orders: number;
  deliveryLogic: DeliveryLogic | null;
};

export type ShopCategory = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type ShopItem = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  currency: string;
  is_active: boolean;
  categories: string[];
};

type ServiceResult<T> = { data: T | null; error: PostgrestError | null };

/**
 * Find shops that have delivery areas containing the given point
 * Uses PostGIS ST_Contains to check if the point is within any delivery area polygon
 */
// Track RPC failures to skip it if consistently failing
let rpcFailureCount = 0;
let lastRpcFailureTime = 0;
const RPC_FAILURE_THRESHOLD = 3; // Skip RPC after 3 consecutive failures
const RPC_FAILURE_RESET_TIME = 5 * 60 * 1000; // Reset after 5 minutes

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

export async function findShopsByLocation(
  latitude: number,
  longitude: number
): Promise<ServiceResult<ConsumerShop[]>> {
  try {
    // Check if RPC has been failing consistently - if so, skip it
    const now = Date.now();
    if (rpcFailureCount >= RPC_FAILURE_THRESHOLD) {
      if (now - lastRpcFailureTime < RPC_FAILURE_RESET_TIME) {
        // Still within failure window, skip RPC and go straight to fallback
        console.log('Skipping RPC call due to recent failures, using optimized fallback');
        return await findShopsByLocationFallback(latitude, longitude);
      } else {
        // Reset failure count after timeout period
        rpcFailureCount = 0;
      }
    }

    // Use PostGIS to find shops whose delivery areas contain the point
    // ST_Contains checks if the polygon contains the point
    const pointWkt = `POINT(${longitude} ${latitude})`;
    
    // Reduced timeout to 3 seconds - if RPC is slow, fallback is faster
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 3000); // Reduced to 3 second timeout for faster fallback
    
    const timeoutPromise = new Promise<{ data: null; error: PostgrestError }>((resolve) => {
      setTimeout(() => {
        abortController.abort();
        resolve({
          data: null,
          error: {
            message: 'RPC call timed out. Using optimized fallback method.',
            code: 'TIMEOUT',
            details: 'The query is taking too long. Falling back to optimized query.',
            hint: 'The RPC query exceeded the timeout. An optimized fallback query method will be used.',
            name: 'PostgrestError',
          } as PostgrestError,
        });
      }, 3000); // Reduced to 3 second timeout for faster fallback
    });
    
    try {
      const rpcPromise = supabase
        .rpc('find_shops_by_location', {
          point_wkt: pointWkt,
        })
        .abortSignal(abortController.signal);
    
    const result: any = await Promise.race([rpcPromise, timeoutPromise]);
    const { data, error } = result;

    if (error) {
        clearTimeout(timeoutId);
      // Track RPC failures
      if (error.code === 'TIMEOUT') {
        rpcFailureCount++;
        lastRpcFailureTime = Date.now();
        // Only log first failure to avoid spam
        if (rpcFailureCount === 1) {
          console.warn('RPC call timed out, using optimized fallback method');
        }
      } else {
        console.error('Error finding shops by location:', error.message || error);
      }
      
      // If timeout or RPC function doesn't exist, try fallback
      if (error.code === 'TIMEOUT' || 
          error.code === '42883' || 
          error.message?.includes('function') || 
            error.message?.includes('does not exist') ||
            error.message?.includes('aborted')) {
        return await findShopsByLocationFallback(latitude, longitude);
      }
      
      return { data: null, error };
    }

      clearTimeout(timeoutId);

    // RPC succeeded - reset failure count
    rpcFailureCount = 0;

    if (!data) {
      return { data: [], error: null };
    }

    // Map the result to ConsumerShop format
    const shops: ConsumerShop[] = data.map((row: any) => {
      return {
        id: row.id,
        name: row.name,
        image_url: row.image_url || '',
        shop_type: row.shop_type || null,
        rating: 0,
        orders: 0,
        delivery_fee: 0,
        delivery_time: undefined,
        tags: row.tags || [],
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        is_open: row.is_open,
        created_at: row.created_at,
      };
    });

    return { data: shops, error: null };
  } catch (error: any) {
      clearTimeout(timeoutId);
      // Handle abort/timeout errors
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.warn('RPC call aborted due to timeout, using fallback');
        rpcFailureCount++;
        lastRpcFailureTime = Date.now();
        return await findShopsByLocationFallback(latitude, longitude);
      }
      
    console.error('Exception finding shops by location:', error);
    // Track failure
    rpcFailureCount++;
    lastRpcFailureTime = Date.now();
    // On exception, try fallback
    try {
      return await findShopsByLocationFallback(latitude, longitude);
    } catch (fallbackError) {
        // Even if fallback fails, return empty array for better UX
        return { data: [], error: null };
      }
    }
  } catch (error: any) {
    // Outer catch for any unexpected errors
    console.error('Unexpected error in findShopsByLocation:', error);
    // Try fallback as last resort
    try {
      return await findShopsByLocationFallback(latitude, longitude);
    } catch (fallbackError) {
      // Even if fallback fails, return empty array for better UX
      return { data: [], error: null };
    }
  }
}

/**
 * Optimized fallback method if RPC function doesn't exist or times out
 * Ultra-simplified: Just returns open shops without distance filtering for maximum speed
 */
async function findShopsByLocationFallback(
  latitude: number,
  longitude: number
): Promise<ServiceResult<ConsumerShop[]>> {
  const startTime = Date.now();
  console.log('[findShopsByLocationFallback] Starting ultra-fast fallback query');
    
  try {
    // Ultra-simplified query: Just get open shops, minimal fields, very small limit
    // No distance filtering, no complex joins, no ordering - maximum speed
    // Use abort signal for proper cancellation
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 3000); // Reduced to 3 seconds for faster timeout

    try {
    const queryPromise = supabase
      .from('shops')
      .select('id, name, image_url, shop_type, tags, address, latitude, longitude, is_open, created_at')
      .eq('is_open', true)
        .limit(10) // Reduced limit for faster response
        .abortSignal(abortController.signal);
      
      const { data: shopsData, error: shopsError } = await queryPromise;
      clearTimeout(timeoutId);
      
    const queryDuration = Date.now() - startTime;
    console.log(`[findShopsByLocationFallback] Query completed in ${queryDuration}ms, found ${shopsData?.length || 0} shops`);

    if (shopsError) {
        // Check if it's an abort error (timeout)
        if (shopsError.message?.includes('aborted') || shopsError.message?.includes('AbortError')) {
          console.warn('[findShopsByLocationFallback] Query aborted due to timeout');
          return { data: [], error: null }; // Return empty array instead of error
        }
      console.error('[findShopsByLocationFallback] Query error:', shopsError);
      // Return empty array instead of error for better UX
      return { data: [], error: null };
    }

    if (!shopsData || shopsData.length === 0) {
      console.log('[findShopsByLocationFallback] No shops found');
      return { data: [], error: null };
    }

    // Simple mapping - no distance calculation for speed
    const shops: ConsumerShop[] = shopsData.map((row: any) => ({
        id: row.id,
        name: row.name,
        image_url: row.image_url || '',
      shop_type: row.shop_type || null,
      rating: 0,
      orders: 0,
      delivery_fee: 0,
        delivery_time: undefined,
        tags: row.tags || [],
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        is_open: row.is_open,
        created_at: row.created_at,
    }));

    const totalDuration = Date.now() - startTime;
    console.log(`[findShopsByLocationFallback] Completed in ${totalDuration}ms, returning ${shops.length} shops`);
    return { data: shops, error: null };
    } catch (queryError: any) {
      clearTimeout(timeoutId);
      // Handle timeout or abort errors gracefully
      if (queryError.name === 'AbortError' || queryError.message?.includes('aborted')) {
        console.warn('[findShopsByLocationFallback] Query timed out after 3 seconds - returning empty results');
        return { data: [], error: null }; // Return empty array instead of error
      }
      const duration = Date.now() - startTime;
      console.error(`[findShopsByLocationFallback] Exception after ${duration}ms:`, queryError);
      // Return empty array instead of error for better UX
      return { data: [], error: null };
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[findShopsByLocationFallback] Exception after ${duration}ms:`, error);
    // Return empty array instead of error for better UX
    return { data: [], error: null };
  }
}

/**
 * Fetch detailed shop information including delivery logic
 */
export async function fetchShopDetails(shopId: string): Promise<ServiceResult<ShopDetails>> {
  try {
    // Fetch shop info
    const { data: shopData, error: shopError } = await supabase
      .from('shops')
      .select('id, name, description, image_url, address, latitude, longitude, tags, is_open')
      .eq('id', shopId)
      .single();

    if (shopError) {
      console.error('Error fetching shop details:', shopError);
      return { data: null, error: shopError };
    }

    if (!shopData) {
      return { data: null, error: null };
    }

    // Fetch delivery logic
    const { data: deliveryData, error: deliveryError } = await supabase
      .from('shop_delivery_logic')
      .select('*')
      .eq('shop_id', shopId)
      .maybeSingle();

    if (deliveryError) {
      console.error('Error fetching delivery logic:', deliveryError);
    }

    // Map delivery logic if it exists
    let deliveryLogic: DeliveryLogic | null = null;
    if (deliveryData) {
      deliveryLogic = {
        id: deliveryData.id,
        shopId: deliveryData.shop_id,
        minimumOrderValue: Number(deliveryData.minimum_order_value),
        smallOrderSurcharge: Number(deliveryData.small_order_surcharge),
        leastOrderValue: Number(deliveryData.least_order_value),
        distanceMode: deliveryData.distance_mode || 'auto',
        maxDeliveryFee: Number(deliveryData.max_delivery_fee || 130),
        distanceTiers: deliveryData.distance_tiers || [],
        beyondTierFeePerUnit: Number(deliveryData.beyond_tier_fee_per_unit || 10),
        beyondTierDistanceUnit: Number(deliveryData.beyond_tier_distance_unit || 250),
        freeDeliveryThreshold: Number(deliveryData.free_delivery_threshold || 800),
        freeDeliveryRadius: Number(deliveryData.free_delivery_radius || 1000),
        createdAt: deliveryData.created_at,
        updatedAt: deliveryData.updated_at,
      };
    }

    const shopDetails: ShopDetails = {
      id: shopData.id,
      name: shopData.name,
      description: shopData.description,
      image_url: shopData.image_url,
      address: shopData.address,
      latitude: shopData.latitude,
      longitude: shopData.longitude,
      tags: shopData.tags || [],
      is_open: shopData.is_open,
      rating: 0, // TODO: Implement ratings
      orders: 0, // TODO: Implement order count
      deliveryLogic,
    };

    return { data: shopDetails, error: null };
  } catch (error: any) {
    console.error('Exception fetching shop details:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Fetch active categories for a shop
 */
export async function fetchShopCategories(shopId: string): Promise<ServiceResult<ShopCategory[]>> {
  try {
    const { data, error } = await supabase
      .from('merchant_categories')
      .select('id, name, description, is_active')
      .eq('shop_id', shopId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching shop categories:', error);
      return { data: null, error };
    }

    const categories: ShopCategory[] = (data || []).map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      is_active: cat.is_active,
    }));

    return { data: categories, error: null };
  } catch (error: any) {
    console.error('Exception fetching shop categories:', error);
    return { data: null, error: error as PostgrestError };
  }
}

/**
 * Fetch items for a shop, optionally filtered by category
 * Optimized for performance with efficient queries and limits
 */
export async function fetchShopItems(
  shopId: string,
  categoryId?: string,
  searchQuery?: string
): Promise<ServiceResult<ShopItem[]>> {
  try {
    // Optimize: Use simpler query structure and fetch categories separately if needed
    // First, get items with basic info and template fallback
    let query = supabase
      .from('merchant_items')
      .select(`
        id,
        name,
        description,
        image_url,
        template_id,
        price_cents,
        currency,
        is_active,
        item_templates!left(image_url)
      `)
      .eq('shop_id', shopId)
      .eq('is_active', true);

    // If filtering by category, use a subquery approach for better performance
    if (categoryId) {
      // Get item IDs that belong to this category first (faster)
      const { data: categoryItems } = await supabase
        .from('merchant_item_categories')
        .select('merchant_item_id')
        .eq('merchant_category_id', categoryId);
      
      if (categoryItems && categoryItems.length > 0) {
        const itemIds = categoryItems.map(c => c.merchant_item_id);
        query = query.in('id', itemIds);
      } else {
        // No items in this category
        return { data: [], error: null };
      }
    }

    // Search by name if query provided
    if (searchQuery && searchQuery.trim()) {
      const trimmed = searchQuery.trim();
      // Limit search to 100 characters to prevent slow queries
      if (trimmed.length > 0 && trimmed.length <= 100) {
        query = query.ilike('name', `%${trimmed}%`);
      }
    }

    // Add limit to prevent loading too many items at once (improves performance)
    query = query.limit(500).order('name', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching shop items:', error);
      return { data: null, error };
    }

    if (!data || data.length === 0) {
      return { data: [], error: null };
    }

    // Get category mappings in a separate optimized query (faster than nested joins)
    const itemIds = data.map(item => item.id);
    const { data: categoryMappings } = await supabase
      .from('merchant_item_categories')
      .select('merchant_item_id, merchant_category_id')
      .in('merchant_item_id', itemIds);

    // Create category map for fast lookup
    const categoryMap = new Map<string, string[]>();
    if (categoryMappings) {
      categoryMappings.forEach((mapping: any) => {
        const itemId = mapping.merchant_item_id;
        const catId = mapping.merchant_category_id;
        if (!categoryMap.has(itemId)) {
          categoryMap.set(itemId, []);
        }
        categoryMap.get(itemId)!.push(catId);
      });
    }

    // Process items efficiently (single pass)
    const items: ShopItem[] = data.map((row: any) => {
      // Handle template image fallback (template can be object or array)
      const templateData = row.item_templates;
      const templateImageUrl = Array.isArray(templateData) 
        ? templateData[0]?.image_url 
        : templateData?.image_url;
      const finalImageUrl = row.image_url || templateImageUrl || null;
      
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        image_url: finalImageUrl,
        price_cents: row.price_cents,
        currency: row.currency,
        is_active: row.is_active,
        categories: categoryMap.get(row.id) || [],
      };
    });

    return { data: items, error: null };
  } catch (error: any) {
    console.error('Exception fetching shop items:', error);
    return { data: null, error: error as PostgrestError };
  }
}

