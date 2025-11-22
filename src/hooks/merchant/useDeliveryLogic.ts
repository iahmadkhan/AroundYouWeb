import { useMutation, useQuery, useQueryClient } from 'react-query';

import type { DeliveryLogic, DeliveryLogicPayload } from '../../services/merchant/deliveryLogicService';
import { fetchDeliveryLogic, saveDeliveryLogic } from '../../services/merchant/deliveryLogicService';

export function useDeliveryLogic(shopId: string) {
  return useQuery(['delivery-logic', shopId], async () => {
    const { data, error } = await fetchDeliveryLogic(shopId);
    if (error) {
      throw error;
    }
    return data;
  }, {
    enabled: Boolean(shopId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSaveDeliveryLogic(shopId: string) {
  const queryClient = useQueryClient();

  return useMutation(async (payload: DeliveryLogicPayload) => {
    const { data, error } = await saveDeliveryLogic(shopId, payload);
    if (error) {
      throw error;
    }
    return data;
  }, {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-logic', shopId] });
    },
  });
}

