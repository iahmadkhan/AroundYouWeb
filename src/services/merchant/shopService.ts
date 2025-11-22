import { supabase } from '../supabase';
import { getEnvVar } from '../env';

export type ShopType = 'Grocery' | 'Meat' | 'Vegetable' | 'Stationery' | 'Dairy';

export interface CreateShopData {
  name: string;
  description: string;
  shop_type: ShopType;
  address: string;
  latitude: number;
  longitude: number;
  image_url?: string;
  tags?: string[];
}

export interface MerchantShop {
  id: string;
  merchant_id: string;
  name: string;
  description: string;
  shop_type: ShopType;
  address: string;
  latitude: number;
  longitude: number;
  image_url: string | null;
  tags: string[];
  is_open: boolean;
  orders_today: number; // Calculated field, not in DB
  orders_cancelled_today: number; // Calculated field, not in DB
  revenue_today: number; // Calculated field, not in DB
  created_at: string;
  updated_at: string;
}

// Helper function to upload using Supabase Storage API
// Note: Supabase Storage uses S3 backend. The S3 credentials you created bypass RLS at the storage level.
// We use Supabase Storage API endpoint which internally uses the S3 backend with your credentials.
async function uploadWithStorageAPI(
  supabaseUrl: string,
  apikey: string,
  authToken: string,
  bucketName: string,
  filePath: string,
  imageData: string | File | Blob, // Can be data URI, File, or Blob
  mime: string,
  filename: string
): Promise<{ url: string | null; error: { message: string } | null }> {
  const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucketName}/${encodedPath}`;
  
  return new Promise((resolve) => {
    // Create FormData with the file
    const formData = new FormData();
    
    // Function to send the actual request
    const sendRequest = () => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          console.log(`Upload progress: ${percentComplete.toFixed(2)}%`);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('✅ Upload successful');
          // Get public URL from Supabase
          const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);
          resolve({ url: urlData.publicUrl, error: null });
        } else {
          let errorMessage = 'Upload failed';
          let errorDetails: any = null;
          try {
            errorDetails = JSON.parse(xhr.responseText);
            errorMessage = errorDetails.message || errorDetails.error || errorDetails.error_description || errorMessage;
            // Check for specific error codes
            if (errorDetails.error === 'invalid_request' || errorDetails.error === 'unauthorized') {
              errorMessage = 'Authentication failed. Please log in again.';
            } else if (xhr.status === 400) {
              // More specific 400 error messages
              if (errorDetails.message?.includes('size') || errorDetails.message?.includes('too large')) {
                errorMessage = 'Image file is too large. Please use a smaller image (max 5MB).';
              } else if (errorDetails.message?.includes('format') || errorDetails.message?.includes('type')) {
                errorMessage = 'Invalid image format. Please use JPG, PNG, WebP, or AVIF.';
              } else {
                errorMessage = errorMessage || 'Invalid request. Please check the file format and try again.';
              }
            }
          } catch {
            errorMessage = `Upload failed with status ${xhr.status}: ${xhr.statusText}`;
          }
          console.error('❌ Upload error:', {
            status: xhr.status,
            statusText: xhr.statusText,
            message: errorMessage,
            response: xhr.responseText,
            errorDetails,
            uploadUrl,
            filePath,
            mime,
            filename
          });
          resolve({ url: null, error: { message: errorMessage } });
        }
      });

      xhr.addEventListener('error', () => {
        console.error('❌ Upload network error');
        resolve({ url: null, error: { message: 'Network error during upload. Please check your connection and try again.' } });
      });

      xhr.addEventListener('abort', () => {
        console.error('❌ Upload aborted');
        resolve({ url: null, error: { message: 'Upload was cancelled' } });
      });

      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
      xhr.setRequestHeader('apikey', apikey);
      xhr.setRequestHeader('x-upsert', 'false');
      // Don't set Content-Type header - let browser set it with boundary for multipart/form-data
      
      xhr.send(formData);
    };

    // Handle different input types for web compatibility
    if (imageData instanceof File) {
      // Web: File object
      formData.append('file', imageData);
      sendRequest();
    } else if (imageData instanceof Blob) {
      // Web: Blob object - convert to File for better compatibility
      const file = new File([imageData], filename, { type: mime, lastModified: Date.now() });
      formData.append('file', file);
      sendRequest();
    } else if (typeof imageData === 'string' && imageData.startsWith('data:')) {
      // Data URI: Use fetch to convert to blob (more reliable)
      fetch(imageData)
        .then(response => response.blob())
        .then(blob => {
          const file = new File([blob], filename, { type: mime, lastModified: Date.now() });
          formData.append('file', file);
          sendRequest();
        })
        .catch(error => {
          console.error('Failed to convert data URI to blob:', error);
          resolve({ url: null, error: { message: 'Failed to process image data' } });
        });
    } else if (typeof imageData === 'string' && (imageData.startsWith('http://') || imageData.startsWith('https://'))) {
      // Remote URL: Fetch and convert to Blob then File
      fetch(imageData)
        .then(response => response.blob())
        .then(blob => {
          const file = new File([blob], filename, { type: mime, lastModified: Date.now() });
          formData.append('file', file);
          sendRequest();
        })
        .catch(error => {
          console.error('Failed to fetch remote image:', error);
          resolve({ url: null, error: { message: 'Failed to fetch image from URL' } });
        });
    } else {
      // Fallback: Try to create a File from the string
      const blob = new Blob([imageData], { type: mime, lastModified: Date.now() });
      const file = new File([blob], filename, { type: mime, lastModified: Date.now() });
      formData.append('file', file);
      sendRequest();
    }
  });
}

// Upload shop image to Supabase storage
// Accepts: data URI string, File object, Blob object, or URL string
export async function uploadShopImage(
  userId: string,
  imageUri: string | File | Blob
): Promise<{ url: string | null; error: { message: string } | null }> {
  try {
    // Derive mime type from uri/file; default to jpeg
    const deriveMimeFromInput = (input: string | File | Blob): { extension: string; mime: string } => {
      if (input instanceof File) {
        const mime = input.type || 'image/jpeg';
        // Handle AVIF and other formats
        let extension = 'jpg';
        if (mime.includes('avif')) extension = 'avif';
        else if (mime.includes('webp')) extension = 'webp';
        else if (mime.includes('png')) extension = 'png';
        else if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
        else extension = mime.split('/')[1]?.split(';')[0] || 'jpg';
        return { extension, mime };
      }
      if (input instanceof Blob) {
        const mime = input.type || 'image/jpeg';
        let extension = 'jpg';
        if (mime.includes('avif')) extension = 'avif';
        else if (mime.includes('webp')) extension = 'webp';
        else if (mime.includes('png')) extension = 'png';
        else if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
        else extension = mime.split('/')[1]?.split(';')[0] || 'jpg';
        return { extension, mime };
      }
      // String input (URI or data URI)
      if (input.startsWith('data:')) {
        const mimeMatch = input.match(/data:([^;]+)/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        let extension = 'jpg';
        if (mime.includes('avif')) extension = 'avif';
        else if (mime.includes('webp')) extension = 'webp';
        else if (mime.includes('png')) extension = 'png';
        else if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
        else extension = mime.split('/')[1]?.split(';')[0] || 'jpg';
        return { extension, mime };
      }
      const lower = input.split('?')[0].split('#')[0].toLowerCase();
      if (lower.endsWith('.avif')) return { extension: 'avif', mime: 'image/avif' };
      if (lower.endsWith('.png')) return { extension: 'png', mime: 'image/png' };
      if (lower.endsWith('.webp')) return { extension: 'webp', mime: 'image/webp' };
      if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return { extension: 'jpg', mime: 'image/jpeg' };
      return { extension: 'jpg', mime: 'image/jpeg' };
    };

    const { extension, mime } = deriveMimeFromInput(imageUri);

    // Generate unique filename with correct extension
    const timestamp = Date.now();
    const filename = `shop-${userId}-${timestamp}.${extension}`;
    // Path within the bucket (no prefix needed - bucketName already specifies it)
    const filePath = filename;

    // Get Supabase configuration
    const supabaseUrl = getEnvVar('SUPABASE_URL') || '';
    const supabaseAnonKey = getEnvVar('SUPABASE_ANON_KEY') || '';
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return { url: null, error: { message: 'Supabase configuration missing' } };
    }

    // Get session token for authenticated upload
    // RLS policies should allow authenticated users to upload to shop-images bucket
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return { url: null, error: { message: 'Not authenticated. Please log in again.' } };
    }

    // Handle different URI types
    if (typeof imageUri === 'string' && imageUri.startsWith('data:')) {
      // Data URI (base64) - common for web file inputs
      console.log('Uploading data URI:', { filePath, mime, filename });
      return uploadWithStorageAPI(
        supabaseUrl,
        supabaseAnonKey,
        session.access_token,
        'shop-images',
        filePath,
        imageUri,
        mime,
        filename
      );
    } else if (typeof imageUri === 'string' && (imageUri.startsWith('http://') || imageUri.startsWith('https://'))) {
      // Remote URL - fetch and convert to blob
    const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }
    const blob = await response.blob();

      const { error } = await supabase.storage
      .from('shop-images')
      .upload(filePath, blob, {
          contentType: mime,
          upsert: false,
        });

      if (error) {
        console.error('Supabase upload error:', error);
        return { url: null, error: { message: error.message } };
      }
    } else if (imageUri instanceof File || imageUri instanceof Blob) {
      // Web: File or Blob object directly
      console.log('Uploading File/Blob:', { filePath, mime, filename });
      const { error } = await supabase.storage
        .from('shop-images')
        .upload(filePath, imageUri, {
          contentType: mime,
        upsert: false,
      });

    if (error) {
        console.error('Supabase upload error:', error);
      return { url: null, error: { message: error.message } };
      }
    } else {
      // Try using the uploadWithStorageAPI for other formats
      console.log('Uploading with storage API:', { filePath, mime, filename });
      return uploadWithStorageAPI(
        supabaseUrl,
        supabaseAnonKey,
        session.access_token,
        'shop-images',
        filePath,
        imageUri,
        mime,
        filename
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('shop-images')
      .getPublicUrl(filePath);

    return { url: urlData.publicUrl, error: null };
  } catch (error: any) {
    console.error('Upload error:', error);
    return { url: null, error: { message: error.message || 'Failed to upload image' } };
  }
}

// Pick image from device - this will be implemented in the component using react-native-image-picker
// For now, this is a placeholder function that can accept an image URI
export async function validateImageUri(uri: string): Promise<{ valid: boolean; error: { message: string } | null }> {
  try {
    if (!uri) {
      return { valid: false, error: { message: 'No image URI provided' } };
    }
    // Basic validation - in production, you might want to check file size, format, etc.
    return { valid: true, error: null };
  } catch (error: any) {
    return { valid: false, error: { message: error.message || 'Invalid image' } };
  }
}

// Create a new shop
export async function createShop(
  userId: string,
  data: CreateShopData
): Promise<{ shop: MerchantShop | null; error: { message: string } | null }> {
  try {
    // Optimized: Use maybeSingle() instead of single() to avoid errors when not found
    // Add timeout to prevent hanging
    const merchantAccountPromise = supabase
      .from('merchant_accounts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) => {
      setTimeout(() => {
        resolve({ data: null, error: { message: 'Query timeout', code: 'TIMEOUT' } });
      }, 5000); // 5 second timeout
    });

    const { data: merchantAccount, error: merchantError } = await Promise.race([
      merchantAccountPromise,
      timeoutPromise
    ]);

    // If timeout or unexpected error, return error
    if (merchantError && merchantError.code !== 'PGRST116' && merchantError.code !== 'TIMEOUT') {
      return { shop: null, error: { message: 'Merchant account check failed. Please try again.' } };
    }

    // If timeout, try to create merchant account anyway (optimistic approach)
    let merchantId = merchantAccount?.id;
    if (!merchantId) {
      // Create merchant account with timeout
      const createMerchantPromise = supabase
        .from('merchant_accounts')
        .insert({
          user_id: userId,
          shop_type: data.shop_type.toLowerCase() as any,
          number_of_shops: '1',
          status: 'none',
        })
        .select('id')
        .maybeSingle();

      const createTimeoutPromise = new Promise<{ data: any; error: any }>((resolve) => {
        setTimeout(() => {
          resolve({ data: null, error: { message: 'Create merchant account timeout', code: 'TIMEOUT' } });
        }, 5000);
      });

      const { data: newMerchant, error: createMerchantError } = await Promise.race([
        createMerchantPromise,
        createTimeoutPromise
      ]);

      if (createMerchantError && createMerchantError.code !== 'TIMEOUT') {
        // If it's a duplicate key error, try fetching again
        if (createMerchantError.code === '23505' || createMerchantError.message?.includes('unique')) {
          // Race condition: merchant account was created by another request, fetch it
          const { data: existingMerchant } = await supabase
            .from('merchant_accounts')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();
          merchantId = existingMerchant?.id;
        } else {
          return { shop: null, error: { message: createMerchantError.message || 'Failed to create merchant account' } };
        }
      } else if (newMerchant) {
        merchantId = newMerchant.id;
      } else if (createMerchantError?.code === 'TIMEOUT') {
        return { shop: null, error: { message: 'Operation is taking too long. Please try again.' } };
      }
    }

    if (!merchantId) {
      return { shop: null, error: { message: 'Failed to get or create merchant account. Please try again.' } };
    }

    // Create shop with timeout
    const createShopPromise = supabase
      .from('shops')
      .insert({
        merchant_id: merchantId,
        name: data.name,
        description: data.description,
        shop_type: data.shop_type,
        address: data.address,
        latitude: data.latitude,
        longitude: data.longitude,
        image_url: data.image_url || null,
        tags: data.tags || [],
        is_open: true,
      })
      .select()
      .maybeSingle();

    const shopTimeoutPromise = new Promise<{ data: any; error: any }>((resolve) => {
      setTimeout(() => {
        resolve({ data: null, error: { message: 'Create shop timeout', code: 'TIMEOUT' } });
      }, 5000);
    });

    const { data: shop, error } = await Promise.race([
      createShopPromise,
      shopTimeoutPromise
    ]);

    if (error) {
      if (error.code === 'TIMEOUT') {
        return { shop: null, error: { message: 'Shop creation is taking too long. Please try again.' } };
      }
      return { shop: null, error: { message: error.message } };
    }

    if (!shop) {
      return { shop: null, error: { message: 'Failed to create shop. Please try again.' } };
    }

    return { shop: shop as MerchantShop, error: null };
  } catch (error: any) {
    return { shop: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Update an existing shop
export async function updateShop(
  shopId: string,
  userId: string,
  data: Partial<CreateShopData>
): Promise<{ shop: MerchantShop | null; error: { message: string } | null }> {
  try {
    // Verify the shop belongs to the user's merchant account
    const { data: merchantAccount, error: merchantError } = await supabase
      .from('merchant_accounts')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (merchantError) {
      console.error('[updateShop] Error fetching merchant account:', merchantError);
      return { shop: null, error: { message: `Failed to verify merchant account: ${merchantError.message}` } };
    }

    if (!merchantAccount) {
      console.error('[updateShop] Merchant account not found for user:', userId);
      return { shop: null, error: { message: 'Merchant account not found. Please complete merchant registration first.' } };
    }

    // Verify shop ownership
    const { data: existingShop, error: shopError } = await supabase
      .from('shops')
      .select('merchant_id')
      .eq('id', shopId)
      .single();

    if (shopError || !existingShop) {
      return { shop: null, error: { message: 'Shop not found.' } };
    }

    if (existingShop.merchant_id !== merchantAccount.id) {
      return { shop: null, error: { message: 'You do not have permission to update this shop.' } };
    }

    // Prepare update data (only include fields that are provided)
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.shop_type !== undefined) updateData.shop_type = data.shop_type;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.latitude !== undefined) updateData.latitude = data.latitude;
    if (data.longitude !== undefined) updateData.longitude = data.longitude;
    // Handle image_url: null means remove, undefined means don't change, string means update
    if (data.image_url !== undefined) {
      updateData.image_url = data.image_url === null ? null : (data.image_url || null);
    }
    if (data.tags !== undefined) updateData.tags = data.tags || [];

    // Update shop
    const { data: shop, error } = await supabase
      .from('shops')
      .update(updateData)
      .eq('id', shopId)
      .select()
      .single();

    if (error) {
      return { shop: null, error: { message: error.message } };
    }

    // Return shop with calculated stats (same as getMerchantShops)
    const shopWithStats: MerchantShop = {
      ...shop,
      orders_today: 0,
      orders_cancelled_today: 0,
      revenue_today: 0,
    };

    return { shop: shopWithStats, error: null };
  } catch (error: any) {
    return { shop: null, error: { message: error.message || 'An error occurred' } };
  }
}

// Get all shops for a merchant
export async function getMerchantShops(
  userId: string
): Promise<{ shops: MerchantShop[]; error: { message: string } | null }> {
  try {
    // Get merchant account
    const { data: merchantAccount, error: merchantError } = await supabase
      .from('merchant_accounts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (merchantError) {
      return { shops: [], error: null }; // No merchant account, return empty array
    }

    // Get shops with optimized stats calculation in database
    const { data: shops, error } = await supabase
      .from('shops')
      .select('*')
      .eq('merchant_id', merchantAccount.id)
      .order('created_at', { ascending: false });

    if (error) {
      return { shops: [], error: { message: error.message } };
    }

    if (!shops || shops.length === 0) {
      return { shops: [], error: null };
    }

    // Calculate stats for all shops in parallel using database aggregations
    const today = new Date().toISOString().split('T')[0];
    const shopIds = shops.map(s => s.id);
    
    // Get today's orders stats for all shops in one query
    // Use placed_at instead of created_at and total_cents instead of total_amount
    const { data: ordersStats, error: ordersError } = await supabase
      .from('orders')
      .select('shop_id, status, total_cents, placed_at')
      .in('shop_id', shopIds)
      .gte('placed_at', `${today}T00:00:00.000Z`)
      .lt('placed_at', `${today}T23:59:59.999Z`);

    // Process stats efficiently
    const statsMap = new Map<string, { orders_today: number; orders_cancelled_today: number; revenue_today: number }>();
    
    if (ordersStats && !ordersError) {
      ordersStats.forEach((order: any) => {
        const shopId = order.shop_id;
        if (!statsMap.has(shopId)) {
          statsMap.set(shopId, { orders_today: 0, orders_cancelled_today: 0, revenue_today: 0 });
        }
        const stats = statsMap.get(shopId)!;
        stats.orders_today++;
        if (order.status === 'cancelled') {
          stats.orders_cancelled_today++;
        }
        if ((order.status === 'completed' || order.status === 'delivered') && order.total_cents) {
          // Convert cents to rupees
          stats.revenue_today += (Number(order.total_cents) || 0) / 100;
        }
      });
    }

    // Map shops with their stats
    const shopsWithStats: MerchantShop[] = shops.map((shop) => {
      const stats = statsMap.get(shop.id) || { orders_today: 0, orders_cancelled_today: 0, revenue_today: 0 };
      return {
      ...shop,
        orders_today: stats.orders_today,
        orders_cancelled_today: stats.orders_cancelled_today,
        revenue_today: stats.revenue_today,
      };
    });

    return { shops: shopsWithStats, error: null };
  } catch (error: any) {
    return { shops: [], error: { message: error.message || 'An error occurred' } };
  }
}

// Delete a shop
export async function deleteShop(
  shopId: string
): Promise<{ success: boolean; error: { message: string } | null }> {
  try {
    // Delete the shop (RLS policies will ensure user can only delete their own shops)
    const { error } = await supabase
      .from('shops')
      .delete()
      .eq('id', shopId);

    if (error) {
      return { success: false, error: { message: error.message } };
    }

    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: { message: error.message || 'An error occurred' } };
  }
}

