import { supabase } from '../../../src/services/supabase';

/**
 * Check if there are images in Supabase Storage for a shop
 * This can help identify if images exist but aren't linked to items
 */
export async function checkStorageImages(shopId: string) {
  try {
    // List files in item-images bucket for this shop
    const { data, error } = await supabase.storage
      .from('item-images')
      .list(`${shopId}`, {
        limit: 100,
        offset: 0,
      });

    if (error) {
      console.error('Error checking storage:', error);
      return { images: [], error };
    }

    return { images: data || [], error: null };
  } catch (err: any) {
    console.error('Error checking storage images:', err);
    return { images: [], error: err };
  }
}

/**
 * Get public URL for an image in storage
 */
export function getStorageImageUrl(shopId: string, fileName: string): string {
  const { data } = supabase.storage
    .from('item-images')
    .getPublicUrl(`item-images/${shopId}/${fileName}`);
  
  return data.publicUrl;
}

