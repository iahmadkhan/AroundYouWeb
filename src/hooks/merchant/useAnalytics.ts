import { useQuery } from 'react-query';

import type { AnalyticsData } from '../../services/merchant/analyticsService';
import { getMerchantAnalytics, getShopAnalytics } from '../../services/merchant/analyticsService';

export function useAnalytics(merchantId: string) {
  return useQuery(['analytics', merchantId], async () => {
    const { data, error } = await getMerchantAnalytics(merchantId);
    if (error) {
      throw error;
    }
    return data;
  }, {
    enabled: Boolean(merchantId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

export function useShopAnalytics(shopId: string) {
  return useQuery(['shop-analytics', shopId], async () => {
    const { data, error } = await getShopAnalytics(shopId);
    if (error) {
      throw error;
    }
    return data;
  }, {
    enabled: Boolean(shopId),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

