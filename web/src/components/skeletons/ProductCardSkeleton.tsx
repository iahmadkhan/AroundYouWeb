import React from 'react';

export default function ProductCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden animate-fade-in">
      <div className="w-full h-32 sm:h-40 bg-gray-200 dark:bg-gray-700 animate-shimmer bg-[length:2000px_100%]" />
      <div className="p-3 sm:p-4">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2 animate-shimmer bg-[length:2000px_100%]" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3 animate-shimmer bg-[length:2000px_100%]" />
        <div className="flex items-center justify-between">
          <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer bg-[length:2000px_100%]" />
          <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-shimmer bg-[length:2000px_100%]" />
        </div>
      </div>
    </div>
  );
}

