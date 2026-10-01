import React from 'react';
import {C, FONT_SERIF} from '../theme';

/**
 * The giant glass hijama cup standing in the clearing like a little house, with a round
 * wooden door and a "haloe Home" sign. Origin (0,0) = centre of the base on the ground.
 * doorOpen 0..1 swings the door on its left hinge and releases a warm glow.
 */
export type CupHouseProps = {
  x: number;
  y: number;
  doorOpen: number;
  sign: string;
  signOpacity?: number;
  frame: number;
};

export const DOOR_R = 140;
export const DOOR_CY = -170;

export const CupHouse: React.FC<CupHouseProps> = ({x, y, doorOpen, sign, signOpacity = 1, frame}) => {
  const ang = doorOpen * 78; // degrees swung
  const doorScale = Math.cos((ang * Math.PI) / 180);
  const glow = 0.35 + doorOpen * 0.65;
  const flicker = 1 + Math.sin(frame / 5) * 0.03;
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <radialGradient id="cupInner" cx="0.5" cy="0.62" r="0.62">
          <stop offset="0" stopColor="#FFE6A8" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#F2C77A" stopOpacity="0.55" />
          <stop offset="1" stopColor="#CFE8DA" stopOpacity="0.25" />
        </radialGradient>
        <linearGradient id="cupGlass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E9FAF2" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#CFEBDD" stopOpacity="0.14" />
          <stop offset="1" stopColor="#E9FAF2" stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id="doorGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF0BE" stopOpacity="1" />
          <stop offset="0.6" stopColor="#FFD98A" stopOpacity="0.7" />
          <stop offset="1" stopColor="#FFD98A" stopOpacity="0" />
        </radialGradient>
        <clipPath id="doorClip">
          <circle cx={0} cy={DOOR_CY} r={DOOR_R} />
        </clipPath>
        <radialGradient id="spill" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFE3A0" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFE3A0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ground shadow */}
      <ellipse cx={0} cy={10} rx={380} ry={34} fill="#031E16" opacity={0.45} />
      {/* spill of warm light on the ground when the door opens */}
      <ellipse cx={0} cy={40} rx={420 * doorOpen + 120} ry={70 * doorOpen + 30} fill="url(#spill)" opacity={0.2 + doorOpen * 0.7} />

      {/* inner room glow seen through the glass */}
      <path
        d="M-286 0 C-296 -260 -238 -632 0 -692 C238 -632 296 -260 286 0 Z"
        fill="url(#cupInner)"
        opacity={glow}
      />
      {/* faint interior shapes: shelf + plant silhouette */}
      <g opacity={0.35 * glow}>
        <rect x={-210} y={-420} width={120} height={10} rx={5} fill={C.woodDark} />
        <rect x={-190} y={-466} width={14} height={46} rx={4} fill="#FFF3D1" />
        <rect x={-160} y={-452} width={14} height={32} rx={4} fill="#FFF3D1" />
        <path d="M150 -380 C130 -450 170 -500 200 -520 C190 -470 220 -430 150 -380 Z" fill="#7BAE8C" />
      </g>

      {/* glass body */}
      <path
        d="M-292 0 C-304 -262 -242 -640 0 -700 C242 -640 304 -262 292 0 Z"
        fill="url(#cupGlass)"
        stroke={C.ivory}
        strokeOpacity={0.9}
        strokeWidth={6}
      />
      {/* glass highlights */}
      <path d="M-236 -120 C-250 -300 -206 -520 -90 -620" stroke="#fff" strokeOpacity={0.75} strokeWidth={14} strokeLinecap="round" fill="none" />
      <path d="M-262 -60 C-266 -100 -264 -140 -258 -170" stroke="#fff" strokeOpacity={0.6} strokeWidth={10} strokeLinecap="round" fill="none" />
      <path d="M236 -160 C246 -300 214 -470 150 -566" stroke="#fff" strokeOpacity={0.35} strokeWidth={9} strokeLinecap="round" fill="none" />
      {/* rim */}
      <rect x={-312} y={-30} width={624} height={34} rx={17} fill="#E6F4EC" fillOpacity={0.75} stroke={C.ivory} strokeWidth={4} />
      <rect x={-300} y={-22} width={600} height={6} rx={3} fill="#fff" opacity={0.6} />
      {/* valve on top */}
      <rect x={-34} y={-748} width={68} height={56} rx={14} fill={C.gold} />
      <rect x={-22} y={-770} width={44} height={30} rx={14} fill={C.goldBright} />
      <rect x={-34} y={-720} width={68} height={8} fill={C.goldDeep} opacity={0.6} />

      {/* door frame ring */}
      <circle cx={0} cy={DOOR_CY} r={DOOR_R + 14} fill={C.woodDark} />
      <circle cx={0} cy={DOOR_CY} r={DOOR_R + 14} fill="none" stroke={C.gold} strokeWidth={5} />
      {/* what's behind the door: warm light */}
      <circle cx={0} cy={DOOR_CY} r={DOOR_R} fill="#FFE7AE" opacity={0.5 + doorOpen * 0.5} />
      <circle cx={0} cy={DOOR_CY} r={(DOOR_R + 90) * flicker} fill="url(#doorGlow)" opacity={doorOpen} />
      <g clipPath="url(#doorClip)" opacity={doorOpen}>
        <rect x={-120} y={DOOR_CY + 60} width={240} height={90} fill="#E8B96B" opacity={0.7} />
        <rect x={40} y={DOOR_CY - 20} width={80} height={10} rx={4} fill={C.woodDark} opacity={0.5} />
      </g>

      {/* the door itself, hinged on the left edge */}
      <g transform={`translate(${-DOOR_R} 0) scale(${Math.max(0.04, doorScale)} 1) translate(${DOOR_R} 0)`}>
        <g clipPath="url(#doorClip)">
          <circle cx={0} cy={DOOR_CY} r={DOOR_R} fill={C.wood} />
          {[-105, -70, -35, 0, 35, 70, 105].map((px, i) => (
            <rect key={i} x={px - 17} y={DOOR_CY - DOOR_R} width={34} height={DOOR_R * 2} fill={i % 2 ? '#94623A' : '#85552E'} />
          ))}
          {[-105, -70, -35, 0, 35, 70, 105].map((px, i) => (
            <rect key={`l${i}`} x={px + 16} y={DOOR_CY - DOOR_R} width={2} height={DOOR_R * 2} fill={C.woodDark} opacity={0.6} />
          ))}
          <rect x={-DOOR_R} y={DOOR_CY - 62} width={DOOR_R * 2} height={10} fill={C.goldDeep} opacity={0.85} />
          <rect x={-DOOR_R} y={DOOR_CY + 52} width={DOOR_R * 2} height={10} fill={C.goldDeep} opacity={0.85} />
        </g>
        <circle cx={0} cy={DOOR_CY} r={DOOR_R - 3} fill="none" stroke={C.woodDark} strokeWidth={6} />
        <circle cx={88} cy={DOOR_CY + 6} r={13} fill={C.goldBright} stroke={C.goldDeep} strokeWidth={3} />
      </g>

      {/* hanging sign */}
      <g opacity={signOpacity} transform="translate(0 -470)">
        <path d="M-120 -4 L-84 -92 M120 -4 L84 -92" stroke={C.goldDeep} strokeWidth={4} />
        <rect x={-190} y={-12} width={380} height={96} rx={18} fill={C.woodDark} stroke={C.gold} strokeWidth={5} />
        <rect x={-178} y={0} width={356} height={72} rx={12} fill="none" stroke={C.gold} strokeOpacity={0.35} strokeWidth={2} />
        <text
          x={0}
          y={56}
          textAnchor="middle"
          fontFamily={FONT_SERIF}
          fontSize={54}
          fontWeight={700}
          fill={C.ivory}
        >
          {sign}
        </text>
      </g>
    </g>
  );
};
