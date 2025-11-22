import React from 'react';

export default function HomeIcon({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5.5a1 1 0 0 1-1-1v-4.5h-4V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5Z"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}
