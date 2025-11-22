import React from 'react';

interface ImageSkeletonProps {
  className?: string;
  aspectRatio?: 'square' | 'wide' | 'tall';
}

export default function ImageSkeleton({ className = '', aspectRatio = 'wide' }: ImageSkeletonProps) {
  const aspectClasses = {
    square: 'aspect-square',
    wide: 'aspect-video',
    tall: 'aspect-[3/4]',
  };

  return (
    <div
      className={`${aspectClasses[aspectRatio]} bg-gray-200 dark:bg-gray-700 rounded-lg animate-shimmer bg-[length:2000px_100%] ${className}`}
    />
  );
}

