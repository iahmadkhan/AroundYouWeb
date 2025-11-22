import { useEffect } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { getMerchantShops } from '../../services/merchant/shopService';

export function useMerchantShops(userId: string | undefined) {
  const queryClient = useQueryClient();
  
  const query = useQuery(
    ['merchant-shops', userId],
    async () => {
      if (!userId) return [];
      const result = await getMerchantShops(userId);
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.shops;
    },
    {
      enabled: Boolean(userId),
      staleTime: 0, // Always refetch when invalidated
    }
  );

  // Refetch when tab regains focus or visibility changes (browser only)
  useEffect(() => {
    if (!userId) return;
    
    // Check if we're in a browser environment
    const win = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
    const doc = typeof globalThis !== 'undefined' ? (globalThis as any).document : undefined;
    
    if (!win || !doc) {
      return;
    }

    const handleFocus = () => {
      try {
        queryClient.invalidateQueries({ queryKey: ['merchant-shops', userId] });
      } catch (error) {
        console.error('Window focus refetch error:', error);
      }
    };

    const handleVisibility = () => {
      if (doc.visibilityState === 'visible') {
        try {
          queryClient.invalidateQueries({ queryKey: ['merchant-shops', userId] });
        } catch (error) {
          console.error('Visibility refetch error:', error);
        }
      }
    };

    win.addEventListener('focus', handleFocus);
    doc.addEventListener('visibilitychange', handleVisibility);

    return () => {
      win.removeEventListener('focus', handleFocus);
      doc.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId, queryClient]);

  return query;
}

