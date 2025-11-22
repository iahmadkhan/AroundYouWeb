import React from 'react';

export default function ShopCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4 fade-in">
      <div className="flex flex-row">
        {/* Image skeleton */}
        <div className="w-24 h-24 skeleton-dark" />
        
        <div className="flex-1 p-4">
          {/* Title skeleton */}
          <div className="h-5 skeleton mb-2 w-3/4" />
          
          {/* Tags skeleton */}
          <div className="flex flex-row gap-2 mb-2">
            <div className="h-4 skeleton w-16" />
            <div className="h-4 skeleton w-20" />
          </div>
          
          {/* Address skeleton */}
          <div className="h-4 skeleton w-2/3 mb-2" />
          
          {/* Bottom row skeleton */}
          <div className="flex flex-row items-center justify-between mt-2">
            <div className="h-4 skeleton w-20" />
            <div className="h-4 skeleton w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

