import React from 'react';

export default function OrderCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 sm:p-5 mb-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer bg-[length:2000px_100%]" />
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer bg-[length:2000px_100%]" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-shimmer bg-[length:2000px_100%]" />
        <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer bg-[length:2000px_100%]" />
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-shimmer bg-[length:2000px_100%]" />
        <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-shimmer bg-[length:2000px_100%]" />
      </div>
    </div>
  );
}

