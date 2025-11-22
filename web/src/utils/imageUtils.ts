import { supabase } from '../../../src/services/supabase';

/**
 * Converts an image URL to a displayable URL
 * Handles:
 * - Full URLs (returns as-is)
 * - Supabase Storage paths (converts to public URL)
 * - Relative paths
 */
export function getImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;

  // If it's already a full URL (http/https), return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }

  // If it looks like a Supabase Storage path (starts with bucket name or has /storage/v1/)
  if (
    imageUrl.includes('/storage/v1/') ||
    imageUrl.startsWith('item-images/') ||
    imageUrl.startsWith('shop-images/') ||
    imageUrl.startsWith('profile-pictures/')
  ) {
    // Extract bucket and path
    let bucket = 'item-images'; // default bucket
    let path = imageUrl;

    // Check if it's a shop image
    if (imageUrl.startsWith('shop-images/')) {
      bucket = 'shop-images';
      path = imageUrl;
    } else if (imageUrl.startsWith('profile-pictures/')) {
      bucket = 'profile-pictures';
      path = imageUrl;
    } else if (imageUrl.startsWith('item-images/')) {
      bucket = 'item-images';
      path = imageUrl;
    } else if (imageUrl.includes('/storage/v1/object/public/')) {
      // Extract bucket and path from full storage URL
      const parts = imageUrl.split('/storage/v1/object/public/');
      if (parts.length === 2) {
        bucket = parts[1].split('/')[0];
        path = parts[1].substring(bucket.length + 1);
      }
    }

    // Get public URL from Supabase Storage
    try {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (error) {
      console.error('Error getting public URL for image:', error);
      return null;
    }
  }

  // If it's a relative path, try to construct a full URL
  // This assumes images are in a public folder or CDN
  if (imageUrl.startsWith('/')) {
    // You might want to prepend your CDN URL here
    return imageUrl;
  }

  // Return as-is if we can't determine the format
  return imageUrl;
}

