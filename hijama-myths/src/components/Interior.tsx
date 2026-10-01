import React from 'react';
import {random} from 'remotion';
import {C, H, W} from '../theme';

/**
 * haloe Home — the clinic interior.
 * NOTE: built from the mood of the haloe brand photography (warm exposed-stone wall, candlelight,
 * dark wood furniture, eucalyptus, ivory linen). Swap the constants in this file to re-skin it
 * once /assets/clinic-interior.png is available to match exactly.
 */
export const FLOOR_Y = 1250;
export const INTERIOR_FEET_Y = 1440;

const STONES = (() => {
  const out: {x: number; y: number; w: number; h: number; c: string}[] = [];
  const palette = ['#B58E66', '#A98259', '#BE9970', '#9E7A54', '#B08A60', '#C2A07A'];
  let y = 0;
  let row = 0;
  while (y < FLOOR_Y) {
    const h = 64 + Math.floor(random(`rh${row}`) * 24);
    let x = -((row % 2) * 70) - random(`ro${row}`) * 60;
    let i = 0;
    while (x < W) {
      const w = 130 + random(`sw${row}-${i}`) * 120;
      out.push({x, y, w: w - 6, h: h - 6, c: palette[Math.floor(random(`sc${row}-${i}`) * palette.length)]});
      x += w;
      i++;
    }
    y += h;
    row++;
  }
  return out;
})();

const Candle: React.FC<{x: number; y: number; h: number; frame: number; seed: number}> = ({x, y, h, frame, seed}) => {
  const fl = 1 + Math.sin(frame / 4 + seed * 3) * 0.08 + Math.sin(frame / 2.3 + seed) * 0.05;
  return (
    <g>
      <circle cx={x} cy={y - h - 16} r={90} fill="url(#candleGlow)" opacity={0.75 * fl} />
      <rect x={x - 14} y={y - h} width={28} height={h} rx={4} fill="#F4EBD6" />
      <rect x={x - 14} y={y - h} width={10} height={h} rx={4} fill="#fff" opacity={0.35} />
      <rect x={x - 1.5} y={y - h - 8} width={3} height={9} fill="#3A2A20" />
      <path
        d={`M${x} ${y - h - 36 * fl} C${x + 10} ${y - h - 20} ${x + 8} ${y - h - 8} ${x} ${y - h - 6} C${x - 8} ${y - h - 8} ${x - 10} ${y - h - 20} ${x} ${y - h - 36 * fl} Z`}
        fill="#FFD27A"
      />
      <path d={`M${x} ${y - h - 24} C${x + 4} ${y - h - 16} ${x + 3} ${y - h - 10} ${x} ${y - h - 9} C${x - 3} ${y - h - 10} ${x - 4} ${y - h - 16} ${x} ${y - h - 24} Z`} fill="#FFF3C9" />
    </g>
  );
};

const Eucalyptus: React.FC<{x: number; y: number; flip?: boolean; s?: number}> = ({x, y, flip, s = 1}) => {
  const stems = [
    {a: -28, l: 330},
    {a: -6, l: 400},
    {a: 18, l: 340},
    {a: 36, l: 250},
  ];
  return (
    <g transform={`translate(${x} ${y}) scale(${(flip ? -1 : 1) * s} ${s})`}>
      {stems.map((st, i) => (
        <g key={i} transform={`rotate(${st.a})`}>
          <path d={`M0 0 C${6 - i * 2} ${-st.l * 0.4} ${-6 + i * 3} ${-st.l * 0.75} 0 ${-st.l}`} stroke="#6E8C75" strokeWidth={5} fill="none" strokeLinecap="round" />
          {Array.from({length: 9}, (_, k) => {
            const t = 0.2 + k * 0.09;
            const yy = -st.l * t;
            const side = k % 2 ? 1 : -1;
            return (
              <ellipse
                key={k}
                cx={side * 24}
                cy={yy}
                rx={25}
                ry={13}
                transform={`rotate(${side * 28} ${side * 24} ${yy})`}
                fill={k % 3 === 0 ? '#9DB8A2' : '#87A58E'}
              />
            );
          })}
        </g>
      ))}
    </g>
  );
};

export const Interior: React.FC<{frame: number}> = ({frame}) => {
  const lampFlicker = 0.92 + Math.sin(frame / 6) * 0.03 + Math.sin(frame / 3.1) * 0.02;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
      <defs>
        <radialGradient id="candleGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFD58A" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFD58A" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="roomLight" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#FFE2A8" stopOpacity="0.38" />
          <stop offset="0.6" stopColor="#E9A95A" stopOpacity="0.12" />
          <stop offset="1" stopColor="#1A0F06" stopOpacity="0.6" />
        </radialGradient>
        <linearGradient id="floorG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7C5434" />
          <stop offset="1" stopColor="#3B2414" />
        </linearGradient>
        <linearGradient id="alcove" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD88C" />
          <stop offset="1" stopColor="#E7A95C" />
        </linearGradient>
        <linearGradient id="linen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F6EEDC" />
          <stop offset="1" stopColor="#E2D3B6" />
        </linearGradient>
      </defs>

      {/* stone wall */}
      <rect width={W} height={FLOOR_Y} fill="#6F5037" />
      {STONES.map((s, i) => (
        <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={9} fill={s.c} />
      ))}
      <rect width={W} height={FLOOR_Y} fill="#3A2412" opacity={0.18} />

      {/* arched alcove with warm light */}
      <path d="M70 760 V470 A150 150 0 0 1 370 470 V760 Z" fill="#4A3220" />
      <path d="M92 760 V470 A128 128 0 0 1 348 470 V760 Z" fill="url(#alcove)" opacity={lampFlicker} />
      <path d="M92 760 V470 A128 128 0 0 1 348 470 V760 Z" fill="none" stroke="#6B4A2E" strokeWidth={10} />
      <rect x={60} y={758} width={320} height={22} rx={6} fill="#5E3B1F" />
      <Candle x={140} y={758} h={90} frame={frame} seed={1} />
      <Candle x={196} y={758} h={130} frame={frame} seed={2} />
      <Candle x={252} y={758} h={70} frame={frame} seed={3} />
      <Candle x={310} y={758} h={110} frame={frame} seed={4} />

      {/* floor */}
      <rect x={0} y={FLOOR_Y} width={W} height={H - FLOOR_Y} fill="url(#floorG)" />
      {Array.from({length: 9}, (_, i) => (
        <line key={i} x1={i * 135 - 20} y1={FLOOR_Y} x2={(i - 4) * 330 + 540} y2={H} stroke="#2E1B0E" strokeWidth={3} opacity={0.55} />
      ))}
      {[1330, 1440, 1590, 1770].map((y) => (
        <line key={y} x1={0} y1={y} x2={W} y2={y} stroke="#2E1B0E" strokeWidth={2} opacity={0.4} />
      ))}
      <rect x={0} y={FLOOR_Y} width={W} height={10} fill="#2A180B" opacity={0.6} />

      {/* wooden side table with candles + eucalyptus (right) */}
      <g>
        <ellipse cx={920} cy={1330} rx={150} ry={18} fill="#000" opacity={0.28} />
        <Eucalyptus x={1044} y={1088} flip s={0.3} />
        <rect x={820} y={1090} width={250} height={26} rx={6} fill={C.woodLight} />
        <rect x={820} y={1112} width={250} height={8} fill={C.woodDark} opacity={0.5} />
        <rect x={842} y={1116} width={22} height={214} fill={C.wood} />
        <rect x={1026} y={1116} width={22} height={214} fill={C.wood} />
        <Candle x={880} y={1090} h={70} frame={frame} seed={5} />
        <Candle x={930} y={1090} h={48} frame={frame} seed={6} />
        <Candle x={986} y={1090} h={60} frame={frame} seed={7} />
      </g>

      {/* treatment bed (ivory linen, wooden base) */}
      <g>
        <ellipse cx={380} cy={1345} rx={400} ry={22} fill="#000" opacity={0.3} />
        <rect x={30} y={1230} width={26} height={110} fill={C.wood} />
        <rect x={690} y={1230} width={26} height={110} fill={C.wood} />
        <rect x={20} y={1180} width={706} height={62} rx={14} fill={C.woodDark} />
        <rect x={10} y={1110} width={726} height={84} rx={34} fill="url(#linen)" />
        <path d="M60 1126 C200 1112 400 1138 700 1118" stroke="#CDBA97" strokeWidth={4} fill="none" opacity={0.7} />
        <rect x={34} y={1086} width={190} height={46} rx={23} fill="#FBF5E8" />
        <rect x={34} y={1086} width={190} height={14} rx={7} fill="#fff" opacity={0.5} />
        <path d="M450 1112 C500 1180 560 1190 700 1170 L700 1112 Z" fill="#E9DCC0" />
        <rect x={10} y={1176} width={726} height={14} rx={7} fill="#D2C0A0" opacity={0.7} />
      </g>

      {/* warm ambient light and vignette */}
      <rect width={W} height={H} fill="url(#roomLight)" />
      <g style={{mixBlendMode: 'screen'}}>
        {Array.from({length: 22}, (_, i) => (
          <circle
            key={i}
            cx={(random(`dx${i}`) * W + frame * 0.3 * (0.5 + random(`dv${i}`))) % W}
            cy={300 + random(`dy${i}`) * 1000 + Math.sin(frame / 30 + i) * 14}
            r={2 + random(`dr${i}`) * 3}
            fill="#FFE8B8"
            opacity={0.35}
          />
        ))}
      </g>
    </svg>
  );
};
