import React from 'react';

export default function SearchIcon({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="6" stroke={color} strokeWidth={2} />
      <path d="M16 16l4.5 4.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
