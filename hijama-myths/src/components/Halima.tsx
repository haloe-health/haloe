import React from 'react';
import {C} from '../theme';

/**
 * Halima — drawn from the reference photo: ivory hijab, ivory linen long robe,
 * warm tan skin, soft smile. Modest at all times (full-length robe, sleeves to the wrist).
 * Origin (0,0) = centre of her feet, she is ~600px tall at scale 1.
 */
const HIJAB = '#F7F2E7';
const HIJAB_SHADE = '#E3D8C2';
const ROBE = '#EEE4D0';
const ROBE_SHADE = '#D8CAAE';
const EYE = '#2B1D16';
const LIP = '#A65A4D';

export type HalimaProps = {
  view: 'front' | 'side';
  x: number;
  y: number;
  scale?: number;
  opacity?: number;
  /** walk-cycle phase in radians and amplitude 0..1 */
  phase?: number;
  amp?: number;
  /** degrees, negative = looking up (side view) */
  headTilt?: number;
  /** degrees; rotation of arms, 0 = hanging. Negative swings forward / outward. */
  armFront?: number;
  armBack?: number;
  /** horizontal squash, used for the quick "turn" animation */
  squashX?: number;
  frame: number;
};

const Sleeve: React.FC<{angle: number; x: number; y: number}> = ({angle, x, y}) => (
  <g transform={`translate(${x} ${y}) rotate(${angle})`}>
    <path
      d="M-30 -6 C-34 40 -42 120 -46 196 Q0 216 46 196 C42 120 34 40 30 -6 Z"
      fill={ROBE}
    />
    <path
      d="M-30 -6 C-34 40 -42 120 -46 196 Q-30 204 -14 207 C-20 120 -22 40 -18 -4 Z"
      fill={ROBE_SHADE}
      opacity={0.5}
    />
    <path d="M-46 196 Q0 216 46 196" fill="none" stroke={ROBE_SHADE} strokeWidth={3} />
    <circle cx={0} cy={214} r={24} fill={C.skin} />
    <ellipse cx={5} cy={220} rx={13} ry={9} fill={C.skinShade} opacity={0.35} />
  </g>
);

const Eye: React.FC<{cx: number; cy: number; blink: number; look?: number}> = ({
  cx,
  cy,
  blink,
  look = 0,
}) => (
  <g>
    <ellipse cx={cx} cy={cy + look} rx={7.5} ry={Math.max(0.8, 10 * (1 - blink))} fill={EYE} />
    {blink < 0.5 && <circle cx={cx + 2.5} cy={cy - 3 + look} r={2.4} fill="#fff" opacity={0.85} />}
  </g>
);

export const Halima: React.FC<HalimaProps> = ({
  view,
  x,
  y,
  scale = 1,
  opacity = 1,
  phase = 0,
  amp = 0,
  headTilt = 0,
  armFront,
  armBack,
  squashX = 1,
  frame,
}) => {
  // blink roughly every 3.2s
  const bf = frame % 96;
  const blink = bf < 3 ? 1 : bf === 3 || bf === 4 ? 0.5 : 0;
  const bob = -Math.abs(Math.sin(phase)) * 9 * amp;
  const sway = Math.sin(phase) * 1.4 * amp;
  const swing = Math.sin(phase) * 20 * amp;
  const lookUp = headTilt < -4 ? -3 : 0;

  if (view === 'front') {
    const aL = armBack ?? -7;
    const aR = armFront ?? 7;
    return (
      <g transform={`translate(${x} ${y}) scale(${scale * squashX} ${scale})`} opacity={opacity}>
        <ellipse cx={0} cy={6} rx={150} ry={20} fill="#000" opacity={0.18} />
        {/* robe */}
        <path d="M-96 -402 Q0 -428 96 -402 L140 0 Q0 16 -140 0 Z" fill={ROBE} />
        <path
          d="M-60 -300 L-92 0 M-20 -330 L-30 6 M30 -330 L40 8 M70 -300 L100 0"
          stroke={ROBE_SHADE}
          strokeWidth={3}
          opacity={0.7}
          fill="none"
        />
        <path d="M-140 0 Q0 16 140 0 L140 -6 Q0 10 -140 -6 Z" fill={ROBE_SHADE} />
        {/* shoes */}
        <ellipse cx={-34} cy={8} rx={26} ry={9} fill="#6B5237" />
        <ellipse cx={34} cy={8} rx={26} ry={9} fill="#6B5237" />
        {/* arms */}
        <Sleeve angle={aL} x={-96} y={-392} />
        <Sleeve angle={aR} x={96} y={-392} />
        {/* hijab + face */}
        <g transform={`rotate(${headTilt * 0.4} 0 -420)`}>
          <path
            d="M0 -604 C72 -604 114 -560 114 -488 C114 -440 122 -410 152 -372 Q132 -328 90 -316 Q0 -288 -90 -316 Q-132 -328 -152 -372 C-122 -410 -114 -440 -114 -488 C-114 -560 -72 -604 0 -604 Z"
            fill={HIJAB}
          />
          <path
            d="M-152 -372 Q-132 -328 -90 -316 Q-40 -304 0 -304 Q-70 -330 -100 -380 Z"
            fill={HIJAB_SHADE}
            opacity={0.6}
          />
          <path
            d="M152 -372 Q132 -328 90 -316 L60 -330 Q110 -350 120 -400 Z"
            fill={HIJAB_SHADE}
            opacity={0.35}
          />
          <ellipse cx={0} cy={-492} rx={60} ry={72} fill={C.skin} />
          <path
            d="M-66 -500 C-66 -570 -34 -580 0 -580 C34 -580 66 -570 66 -500 C66 -540 40 -556 0 -556 C-40 -556 -66 -540 -66 -500 Z"
            fill={HIJAB}
          />
          <ellipse cx={0} cy={-492} rx={64} ry={76} fill="none" stroke={HIJAB_SHADE} strokeWidth={6} />
          <path d="M-62 -440 Q0 -400 62 -440 L72 -410 Q0 -372 -72 -410 Z" fill={HIJAB} />
          <path
            d="M-38 -528 Q-24 -538 -10 -531 M10 -531 Q24 -538 38 -528"
            stroke="#3A2A20"
            strokeWidth={4.5}
            strokeLinecap="round"
            fill="none"
          />
          <Eye cx={-24} cy={-506} blink={blink} look={lookUp} />
          <Eye cx={24} cy={-506} blink={blink} look={lookUp} />
          <path
            d="M-3 -494 Q-9 -478 -2 -476 Q6 -476 4 -478"
            stroke={C.skinShade}
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
          <path d="M-22 -458 Q0 -436 22 -458" stroke={LIP} strokeWidth={5.5} fill="none" strokeLinecap="round" />
          <circle cx={-40} cy={-472} r={13} fill="#D9806A" opacity={0.22} />
          <circle cx={40} cy={-472} r={13} fill="#D9806A" opacity={0.22} />
        </g>
      </g>
    );
  }

  // side view, facing right
  const aF = armFront ?? swing;
  const aB = armBack ?? -swing;
  return (
    <g transform={`translate(${x} ${y + bob}) scale(${scale * squashX} ${scale})`} opacity={opacity}>
      <ellipse cx={0} cy={6 - bob} rx={140} ry={18} fill="#000" opacity={0.18} />
      <g transform={`rotate(${sway} 0 0)`}>
        <Sleeve angle={aB} x={4} y={-392} />
        {/* robe */}
        <path d="M-72 -398 Q10 -424 84 -396 L116 0 Q-10 16 -122 0 Z" fill={ROBE} />
        <path
          d="M-40 -300 L-70 0 M10 -320 L10 8 M56 -300 L80 0"
          stroke={ROBE_SHADE}
          strokeWidth={3}
          opacity={0.7}
          fill="none"
        />
        <path d="M-122 0 Q-10 16 116 0 L116 -6 Q-10 10 -122 -6 Z" fill={ROBE_SHADE} />
        <ellipse cx={14 + Math.sin(phase) * 34 * amp} cy={8} rx={28} ry={9} fill="#6B5237" />
        <ellipse cx={14 - Math.sin(phase) * 34 * amp} cy={8} rx={28} ry={9} fill="#7C6142" />
        {/* hijab + face */}
        <g transform={`rotate(${headTilt * 0.5} 20 -420)`}>
          <path
            d="M14 -604 C84 -604 112 -558 112 -490 C112 -440 126 -410 138 -372 L124 -316 Q20 -296 -92 -330 C-114 -382 -104 -440 -84 -500 C-64 -574 -30 -604 14 -604 Z"
            fill={HIJAB}
          />
          <path
            d="M-92 -330 C-114 -382 -104 -440 -84 -500 C-100 -440 -60 -380 -20 -340 Z"
            fill={HIJAB_SHADE}
            opacity={0.7}
          />
          <path
            d="M34 -556 C70 -562 96 -540 98 -506 L108 -488 Q100 -482 98 -478 C100 -450 84 -424 56 -418 C36 -424 24 -450 28 -490 Z"
            fill={C.skin}
          />
          <path
            d="M18 -570 C34 -574 44 -566 40 -540 C28 -516 28 -470 40 -440 C30 -428 4 -428 -8 -440 L-8 -560 Z"
            fill={HIJAB}
          />
          <path d="M40 -540 C28 -516 28 -470 40 -440" stroke={HIJAB_SHADE} strokeWidth={5} fill="none" />
          <path
            d="M44 -566 C70 -572 94 -552 96 -524"
            stroke={HIJAB}
            strokeWidth={14}
            fill="none"
            strokeLinecap="round"
          />
          <path d="M60 -522 Q72 -530 86 -524" stroke="#3A2A20" strokeWidth={4.5} strokeLinecap="round" fill="none" />
          <Eye cx={76} cy={-506} blink={blink} look={lookUp} />
          <path d="M70 -444 Q82 -436 94 -446" stroke={LIP} strokeWidth={5} fill="none" strokeLinecap="round" />
          <circle cx={70} cy={-470} r={11} fill="#D9806A" opacity={0.22} />
          <path d="M26 -440 Q64 -404 92 -436 L98 -400 Q50 -370 20 -396 Z" fill={HIJAB} />
        </g>
        <Sleeve angle={aF} x={30} y={-392} />
      </g>
    </g>
  );
};
