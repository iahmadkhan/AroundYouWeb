import React from 'react';

export default function CartIcon({ size = 24, color = '#3B82F6' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5h2l2 12h10l2-8H7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="19" r="1.5" fill={color} />
      <circle cx="17" cy="19" r="1.5" fill={color} />
    </svg>
  );
}
