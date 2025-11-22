import React from 'react';

type CenterHairlineProps = {
  height?: number;
  color?: string;
  opacity?: number;
  strokeWidth?: number;
  dashArray?: string | number[];
};

export default function CenterHairline({
  height = 18,
  color = '#3B82F6',
  opacity = 1,
  strokeWidth = 1.5,
  dashArray = '2,2',
}: CenterHairlineProps) {
  const w = Math.max(strokeWidth, 0.5);
  return (
    <svg width={w + 1} height={height} xmlns="http://www.w3.org/2000/svg">
      <line
        x1={(w + 1) / 2}
        y1={0}
        x2={(w + 1) / 2}
        y2={height}
        stroke={color}
        strokeWidth={w}
        strokeOpacity={opacity}
        strokeDasharray={typeof dashArray === 'string' ? dashArray : dashArray.join(',')}
      />
    </svg>
  );
}
