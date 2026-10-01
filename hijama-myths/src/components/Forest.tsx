import React from 'react';
import {random} from 'remotion';
import {C, H, W} from '../theme';

export const GROUND_Y = 1400; // where Halima's and the cup's feet stand

type Tree = {x: number; h: number; w: number; kind: 'pine' | 'round'; shade: number};

const makeTrees = (seed: string, count: number, span: number, hMin: number, hMax: number, skipFrom?: number, skipTo?: number): Tree[] => {
  const out: Tree[] = [];
  for (let i = 0; i < count; i++) {
    const x = (i + random(`${seed}-x${i}`) * 0.8) * (span / count);
    if (skipFrom !== undefined && skipTo !== undefined && x > skipFrom && x < skipTo) continue;
    const h = hMin + random(`${seed}-h${i}`) * (hMax - hMin);
    out.push({
      x,
      h,
      w: h * (0.34 + random(`${seed}-w${i}`) * 0.12),
      kind: random(`${seed}-k${i}`) > 0.42 ? 'pine' : 'round',
      shade: random(`${seed}-s${i}`),
    });
  }
  return out;
};

const TreeShape: React.FC<{t: Tree; base: number; fill: string; trunk: string}> = ({t, base, fill, trunk}) => {
  const {x, h, w} = t;
  if (t.kind === 'pine') {
    const tiers = [
      [h, h * 0.62, 0.55],
      [h * 0.82, h * 0.4, 0.8],
      [h * 0.6, h * 0.16, 1],
    ];
    return (
      <g>
        <rect x={x - w * 0.05} y={base - h * 0.2} width={w * 0.1} height={h * 0.2} fill={trunk} />
        {tiers.map(([a, b, k], i) => (
          <path
            key={i}
            d={`M${x} ${base - a} L${x + (w * k) / 2} ${base - b} Q${x} ${base - b + h * 0.05} ${x - (w * k) / 2} ${base - b} Z`}
            fill={fill}
          />
        ))}
      </g>
    );
  }
  const r = w * 0.42;
  return (
    <g>
      <rect x={x - w * 0.045} y={base - h * 0.5} width={w * 0.09} height={h * 0.5} fill={trunk} />
      <circle cx={x} cy={base - h * 0.72} r={r} fill={fill} />
      <circle cx={x - r * 0.7} cy={base - h * 0.56} r={r * 0.72} fill={fill} />
      <circle cx={x + r * 0.7} cy={base - h * 0.58} r={r * 0.75} fill={fill} />
    </g>
  );
};

const SPAN = 3600;
const FAR = makeTrees('far', 30, SPAN, 620, 900);
const MID = makeTrees('mid', 26, SPAN, 700, 1000);

const RAYS = [
  {x: 120, w: 150, o: 0.16, s: 0.7},
  {x: 360, w: 110, o: 0.12, s: 1.1},
  {x: 610, w: 170, o: 0.15, s: 0.9},
  {x: 860, w: 100, o: 0.1, s: 1.3},
  {x: 1040, w: 130, o: 0.12, s: 0.6},
];

export type ForestProps = {
  cam: number;
  frame: number;
  /** world x of the clearing centre (no near trees around it) */
  clearingX: number;
  /** final camera position, used to carve the near-layer clearing */
  camEnd: number;
};

export const Forest: React.FC<ForestProps> = ({cam, frame, clearingX, camEnd}) => {
  // near layer is generated per call so we can carve the clearing; trees are cheap
  const near = React.useMemo(
    () => makeTrees('near', 22, SPAN, 760, 1100, clearingX - 0.2 * camEnd - 560, clearingX - 0.2 * camEnd + 560),
    [clearingX, camEnd],
  );
  const tufts = React.useMemo(
    () =>
      Array.from({length: 70}, (_, i) => ({
        x: i * 52 + random(`tf${i}`) * 40,
        y: GROUND_Y + 8 + random(`tfy${i}`) * 200,
        s: 0.6 + random(`tfs${i}`) * 0.8,
        flower: random(`tff${i}`) > 0.82,
      })),
    [],
  );
  const specks = React.useMemo(
    () =>
      Array.from({length: 38}, (_, i) => ({
        x: random(`sx${i}`) * W,
        y: 300 + random(`sy${i}`) * 1100,
        r: 2 + random(`sr${i}`) * 4,
        sp: 0.4 + random(`ss${i}`),
        ph: random(`sp${i}`) * 6.28,
      })),
    [],
  );

  const layer = (f: number) => `translate(${-cam * f} 0)`;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="fSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#06352A" />
          <stop offset="0.35" stopColor="#1F6B52" />
          <stop offset="0.62" stopColor="#8DBBA2" />
          <stop offset="0.8" stopColor="#D8E4CB" />
          <stop offset="1" stopColor="#E9E4C9" />
        </linearGradient>
        <linearGradient id="fGround" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2C6A4F" />
          <stop offset="0.25" stopColor="#164B38" />
          <stop offset="1" stopColor="#072A20" />
        </linearGradient>
        <linearGradient id="fRay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF3C9" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFF3C9" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="fMist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2EBD3" stopOpacity="0" />
          <stop offset="0.6" stopColor="#F2EBD3" stopOpacity="0.5" />
          <stop offset="1" stopColor="#F2EBD3" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="fClearing" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFF1C2" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFF1C2" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#042A20" stopOpacity="0.75" />
          <stop offset="1" stopColor="#042A20" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width={W} height={H} fill="url(#fSky)" />

      {/* light rays */}
      <g style={{mixBlendMode: 'screen'}}>
        {RAYS.map((r, i) => {
          const sway = Math.sin(frame / 38 + i * 1.7) * 14;
          const op = r.o * (0.75 + 0.25 * Math.sin(frame / 30 * r.s + i));
          return (
            <polygon
              key={i}
              points={`${r.x + sway - r.w / 2},0 ${r.x + sway + r.w / 2},0 ${r.x + sway + r.w + 260},1400 ${r.x + sway - 40 + 260},1400`}
              fill="url(#fRay)"
              opacity={op}
              transform={`translate(${-cam * 0.04} 0)`}
            />
          );
        })}
      </g>

      {/* far layer */}
      <g transform={layer(0.12)} opacity={0.55}>
        {FAR.map((t, i) => (
          <TreeShape key={i} t={t} base={1130} fill="#7FAE98" trunk="#6B9984" />
        ))}
      </g>
      <rect x={0} y={760} width={W} height={440} fill="url(#fMist)" />

      {/* mid layer */}
      <g transform={layer(0.38)} opacity={0.9}>
        {MID.map((t, i) => (
          <TreeShape key={i} t={t} base={1260} fill={t.shade > 0.5 ? '#3F8566' : '#367A5E'} trunk="#2C5E49" />
        ))}
      </g>
      <rect x={0} y={900} width={W} height={380} fill="url(#fMist)" opacity={0.6} />

      {/* clearing glow */}
      <ellipse
        cx={clearingX - cam}
        cy={1150}
        rx={620}
        ry={620}
        fill="url(#fClearing)"
        style={{mixBlendMode: 'screen'}}
      />

      {/* near layer */}
      <g transform={layer(0.8)}>
        {near.map((t, i) => (
          <TreeShape key={i} t={t} base={1380} fill={t.shade > 0.5 ? '#1D6149' : '#175240'} trunk="#123D30" />
        ))}
      </g>

      {/* ground */}
      <rect x={0} y={1290} width={W} height={H - 1290} fill="url(#fGround)" />
      <path
        d={`M0 ${GROUND_Y + 10} Q540 ${GROUND_Y - 24} ${W} ${GROUND_Y + 10} L${W} ${GROUND_Y + 150} Q540 ${GROUND_Y + 110} 0 ${GROUND_Y + 150} Z`}
        fill="#8C8A58"
        opacity={0.28}
      />
      <g transform={layer(1)}>
        {tufts.map((t, i) => (
          <g key={i} transform={`translate(${t.x} ${t.y}) scale(${t.s})`}>
            <path d="M-8 0 Q-10 -26 -16 -34 M0 0 Q0 -34 2 -44 M8 0 Q10 -24 18 -30" stroke="#3E8A62" strokeWidth={4} fill="none" strokeLinecap="round" />
            {t.flower && <circle cx={2} cy={-48} r={7} fill={C.ivory} />}
            {t.flower && <circle cx={2} cy={-48} r={3} fill={C.gold} />}
          </g>
        ))}
      </g>

      {/* soft mist pass over everything behind characters */}
      <rect x={0} y={1280} width={W} height={160} fill="url(#fMist)" opacity={0.18} />

      {/* floating pollen */}
      {specks.map((s, i) => (
        <circle
          key={i}
          cx={(s.x - cam * 0.25 * s.sp + Math.sin(frame / 40 + s.ph) * 20 + W * 4) % W}
          cy={s.y + Math.cos(frame / 50 * s.sp + s.ph) * 24}
          r={s.r}
          fill="#FFF4CF"
          opacity={0.45}
        />
      ))}

      {/* darken the top for hook-text legibility */}
      <rect x={0} y={0} width={W} height={760} fill="url(#fTop)" />
    </svg>
  );
};
