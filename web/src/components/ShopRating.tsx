import React from 'react';
import { useQuery } from 'react-query';
import { getShopReviewStats } from '../../../src/services/consumer/reviewService';

interface ShopRatingProps {
  shopId: string;
  highlighted?: boolean;
  className?: string;
}

export default function ShopRating({ shopId, highlighted = false, className }: ShopRatingProps) {
  const { data } = useQuery(['shopReviewStats', shopId], () => getShopReviewStats(shopId), {
    staleTime: 60_000,
  });
  const avg = data?.data?.average_rating ?? 0;
  const total = data?.data?.total_reviews ?? 0;

  const starColor = highlighted ? 'text-white' : 'text-yellow-400';
  const textMuted = highlighted ? 'text-white' : 'text-gray-700';
  const countMuted = highlighted ? 'text-white/80' : 'text-gray-500';

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {total > 0 && (
        <>
          <span className={`${starColor}`}>★</span>
          <span className={`font-semibold text-sm ${textMuted}`}>{avg.toFixed(1)}</span>
        </>
      )}
      <span className={`text-sm ${countMuted}`}>• {total} reviews</span>
    </div>
  );
}


