import React from 'react';

type GeolocateIconProps = {
  size?: number;
  color?: string;
};

export default function GeolocateIcon({ size = 24, color = '#ffffff' }: GeolocateIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer circle */}
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />
      {/* Inner circle */}
      <circle
        cx="12"
        cy="12"
        r="5"
        stroke={color}
        strokeWidth="2"
        fill="none"
      />
      {/* Center dot */}
      <circle
        cx="12"
        cy="12"
        r="1.5"
        fill={color}
      />
    </svg>
  );
}
