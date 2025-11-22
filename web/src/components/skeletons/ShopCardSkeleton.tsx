import React from 'react';

export default function ShopCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in">
      <div className="w-full h-40 sm:h-44 md:h-48 lg:h-52 bg-gray-200 dark:bg-gray-700 animate-shimmer bg-[length:2000px_100%]" />
      <div className="p-3 sm:p-4 md:p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="h-5 sm:h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-shimmer bg-[length:2000px_100%]" />
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer bg-[length:2000px_100%]" />
        </div>
        <div className="flex items-center justify-between mb-3">
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer bg-[length:2000px_100%]" />
          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer bg-[length:2000px_100%]" />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-shimmer bg-[length:2000px_100%]" />
          <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-shimmer bg-[length:2000px_100%]" />
        </div>
      </div>
    </div>
  );
}

