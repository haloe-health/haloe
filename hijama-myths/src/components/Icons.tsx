import React from 'react';
import {C} from '../theme';

export type IconName = 'cup' | 'line' | 'drop' | 'leaf' | 'clock' | 'heart' | 'sparkle' | 'shield';

const stroke = {
  fill: 'none',
  stroke: C.goldBright,
  strokeWidth: 5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const Glyph: React.FC<{name: IconName}> = ({name}) => {
  switch (name) {
    case 'cup':
      return (
        <g {...stroke}>
          <path d="M-26 8 C-28 -22 -14 -34 0 -34 C14 -34 28 -22 26 8 Z" />
          <path d="M-32 8 H32" />
          <path d="M0 -34 V-42" />
          <path d="M-12 22 V34 M0 22 V38 M12 22 V34" strokeWidth={4} />
        </g>
      );
    case 'line':
      return (
        <g {...stroke}>
          <path d="M-30 12 C-14 -14 8 6 30 -14" />
          <path d="M20 22 l0 0 M-6 26 l0 0 M-26 -10 l0 0" strokeWidth={9} />
        </g>
      );
    case 'drop':
      return (
        <g {...stroke}>
          <path d="M0 -34 C14 -12 26 -2 26 14 A26 26 0 0 1 -26 14 C-26 -2 -14 -12 0 -34 Z" />
        </g>
      );
    case 'leaf':
      return (
        <g {...stroke}>
          <path d="M-26 22 C-30 -14 -6 -34 28 -30 C32 4 12 28 -26 22 Z" />
          <path d="M-26 22 L8 -10" />
        </g>
      );
    case 'clock':
      return (
        <g {...stroke}>
          <circle r={30} />
          <path d="M0 -16 V0 L12 8" />
        </g>
      );
    case 'heart':
      return (
        <g {...stroke}>
          <path d="M0 28 C-40 0 -30 -30 -14 -30 C-6 -30 0 -22 0 -18 C0 -22 6 -30 14 -30 C30 -30 40 0 0 28 Z" />
        </g>
      );
    case 'shield':
      return (
        <g {...stroke}>
          <path d="M0 -34 L28 -24 V0 C28 18 12 28 0 34 C-12 28 -28 18 -28 0 V-24 Z" />
          <path d="M-10 0 L-2 9 L12 -8" />
        </g>
      );
    case 'sparkle':
    default:
      return (
        <g {...stroke}>
          <path d="M0 -34 L7 -7 L34 0 L7 7 L0 34 L-7 7 L-34 0 L-7 -7 Z" />
        </g>
      );
  }
};

/** Round emerald badge with a gold line glyph, centred on (0,0). */
export const IconBadge: React.FC<{name: IconName; r?: number}> = ({name, r = 56}) => (
  <g>
    <circle r={r} fill={C.emeraldMid} />
    <circle r={r - 5} fill="none" stroke={C.gold} strokeOpacity={0.5} strokeWidth={2} />
    <g transform={`scale(${r / 56})`}>
      <Glyph name={name} />
    </g>
  </g>
);
