import React from 'react';

export default function AddressIcon({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Pin marker with smooth teardrop shape */}
      <path
        d="M12 2C8.134 2 5 5.134 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.866-3.134-7-7-7z"
        fill={color}
      />
      {/* Inner white circle for contrast */}
      <circle cx="12" cy="9" r="3" fill="#ffffff" />
    </svg>
  );
}
