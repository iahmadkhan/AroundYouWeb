import { useQuery } from 'react-query';
import { getMerchantAccount, MerchantAccount } from '../../services/merchant/merchantService';

export function useMerchantAccount(userId?: string) {
  return useQuery<MerchantAccount | null>(
    ['merchant-account', userId],
    async () => {
      if (!userId) return null;
      const { merchant, error } = await getMerchantAccount(userId);
      if (error && error.message) {
        throw new Error(error.message);
      }
      return merchant;
    },
    {
      enabled: Boolean(userId),
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes - merchant account doesn't change often
    }
  );
}

