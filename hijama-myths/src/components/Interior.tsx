import React from 'react';
import {random} from 'remotion';
import {H, W} from '../theme';

/**
 * haloe Home — redrawn from the real treatment room (assets/clinic-interior.jpg):
 * warm-white walls, copper pipe, wood-framed window with roller blind + fern + Buddha statue,
 * tall white cabinet, white desk with cups and a black lamp, black swivel chair, navy treatment
 * bed with a white paper roll, black armchair with a striped cushion, black & cream chequered tiles.
 * Walls are a touch warmer than the photo so Halima's ivory outfit still reads against them.
 */
export const FLOOR_Y = 1250;
export const INTERIOR_FEET_Y = 1440;

const NAVY = '#2A303B';
const NAVY_HI = '#3E4756';
const WOOD = '#7A3F1E';
const WOOD_DARK = '#5A2D14';
const COPPER = '#B07847';
const COPPER_HI = '#D8A471';
const WHITE = '#F7F4EC';
const WHITE_SHADE = '#DCD5C4';

// ---- chequered floor, drawn in one-point perspective ----
const VP_Y = 700;
const TILE_K = 230 / (H - VP_Y);
const FLOOR_ROWS = Array.from({length: 8}, (_, k) => VP_Y + 550 / (1 - 0.115 * k)).filter((y) => y < H + 400);
const tileX = (c: number, y: number) => W / 2 + c * TILE_K * (y - VP_Y);

const Floor: React.FC = () => {
  const tiles: React.ReactNode[] = [];
  for (let r = 0; r < FLOOR_ROWS.length - 1; r++) {
    const y0 = FLOOR_ROWS[r];
    const y1 = FLOOR_ROWS[r + 1];
    for (let c = -8; c < 8; c++) {
      const dark = (r + c + 16) % 2 === 0;
      tiles.push(
        <polygon
          key={`${r}_${c}`}
          points={`${tileX(c, y0)},${y0} ${tileX(c + 1, y0)},${y0} ${tileX(c + 1, y1)},${y1} ${tileX(c, y1)},${y1}`}
          fill={dark ? '#383A40' : '#EFE7D6'}
        />,
      );
    }
  }
  return (
    <g>
      <rect x={0} y={FLOOR_Y} width={W} height={H - FLOOR_Y} fill="#EFE7D6" />
      {tiles}
      {/* glossy sheen */}
      <polygon points="40,1250 200,1250 -60,1920 -260,1920" fill="#fff" opacity={0.1} />
      <polygon points="520,1250 560,1250 420,1920 330,1920" fill="#fff" opacity={0.06} />
      <rect x={0} y={FLOOR_Y} width={W} height={H - FLOOR_Y} fill="url(#floorFade)" />
    </g>
  );
};

const Fern: React.FC<{x: number; y: number}> = ({x, y}) => (
  <g transform={`translate(${x} ${y})`}>
    {[-62, -38, -14, 12, 36, 60].map((a, i) => {
      const len = 78 + (i % 3) * 14;
      return (
        <g key={i} transform={`rotate(${a})`}>
          <path d={`M0 0 C${a < 0 ? -6 : 6} ${-len * 0.5} ${a < 0 ? -14 : 14} ${-len * 0.8} 0 ${-len}`} stroke="#2F7A32" strokeWidth={3} fill="none" />
          {Array.from({length: 8}, (_, k) => {
            const yy = -len * (0.18 + k * 0.1);
            return (
              <g key={k}>
                <ellipse cx={-13} cy={yy} rx={14} ry={4.5} transform={`rotate(-28 -13 ${yy})`} fill={k % 2 ? '#3F9A3F' : '#348A38'} />
                <ellipse cx={13} cy={yy} rx={14} ry={4.5} transform={`rotate(28 13 ${yy})`} fill={k % 2 ? '#348A38' : '#3F9A3F'} />
              </g>
            );
          })}
        </g>
      );
    })}
    <path d="M-26 0 H26 L20 30 H-20 Z" fill="#2B2B2E" />
  </g>
);

const Buddha: React.FC<{x: number; y: number}> = ({x, y}) => (
  <g transform={`translate(${x} ${y})`} fill="#4A4846">
    <ellipse cx={0} cy={-6} rx={30} ry={11} />
    <path d="M-24 -6 C-24 -44 -14 -52 0 -52 C14 -52 24 -44 24 -6 Z" />
    <circle cx={0} cy={-64} r={13} />
    <ellipse cx={0} cy={-82} rx={5} ry={7} />
    <path d="M-22 -22 C-6 -12 6 -12 22 -22" stroke="#6A6866" strokeWidth={3} fill="none" />
  </g>
);

const Cup: React.FC<{x: number; y: number}> = ({x, y}) => (
  <g transform={`translate(${x} ${y})`}>
    <path d="M-9 0 L-11 -26 H11 L9 0 Z" fill="#DDEBEE" fillOpacity={0.75} stroke="#9FB6BC" strokeWidth={1.4} />
    <rect x={-5} y={-36} width={10} height={11} rx={3} fill="#D9822B" />
  </g>
);

export const Interior: React.FC<{frame: number}> = ({frame}) => {
  const sway = Math.sin(frame / 45) * 6; // light patch drifts very slowly
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
      <defs>
        <linearGradient id="wallG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EFE6D4" />
          <stop offset="1" stopColor="#E0D4BC" />
        </linearGradient>
        <linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6B5638" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="#3A2C18" stopOpacity="0.0" />
          <stop offset="1" stopColor="#2A1D0E" stopOpacity="0.5" />
        </linearGradient>
        <linearGradient id="glassG" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F4F8FA" />
          <stop offset="1" stopColor="#C9D8DE" />
        </linearGradient>
        <linearGradient id="pipeG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={COPPER_HI} />
          <stop offset="0.5" stopColor={COPPER} />
          <stop offset="1" stopColor="#8A5A32" />
        </linearGradient>
        <radialGradient id="vign" cx="0.5" cy="0.45" r="0.8">
          <stop offset="0.55" stopColor="#3B2A14" stopOpacity="0" />
          <stop offset="1" stopColor="#2A1D0E" stopOpacity="0.45" />
        </radialGradient>
      </defs>

      {/* warm-white wall */}
      <rect width={W} height={FLOOR_Y} fill="url(#wallG)" />

      {/* window light falling on the wall */}
      <g opacity={0.28} transform={`translate(${sway} 0)`}>
        <polygon points="60,560 330,500 400,720 130,790" fill="#fff" opacity={0.55} />
        <polygon points="150,600 290,570 330,690 190,720" fill="#FFF8E4" opacity={0.7} />
        <polygon points="180,820 360,780 395,890 215,935" fill="#fff" opacity={0.35} />
      </g>

      {/* copper pipe: along the top, elbow, then down behind the cabinet */}
      <g>
        <path d="M1100 28 L520 98" stroke="url(#pipeG)" strokeWidth={18} strokeLinecap="butt" />
        <path d="M520 98 L700 290 L700 720" stroke="url(#pipeG)" strokeWidth={18} strokeLinejoin="round" fill="none" />
        <circle cx={520} cy={98} r={14} fill={COPPER} />
        <rect x={686} y={282} width={28} height={22} rx={5} fill="#8A5A32" />
      </g>

      {/* round wall clock */}
      <circle cx={340} cy={250} r={28} fill="#1E1E20" />
      <circle cx={340} cy={250} r={20} fill="#F4F1E8" />
      <path d="M340 250 V236 M340 250 L350 256" stroke="#1E1E20" strokeWidth={2.5} strokeLinecap="round" />

      {/* window: wooden frame, roller blind, fern and Buddha on the sill */}
      <g>
        <rect x={768} y={102} width={330} height={156} fill={WOOD} />
        <rect x={780} y={114} width={140} height={132} fill="url(#glassG)" />
        <rect x={930} y={114} width={140} height={132} fill="url(#glassG)" />
        <rect x={768} y={102} width={330} height={78} fill="#9A9C9C" opacity={0.92} />
        <rect x={768} y={174} width={330} height={7} fill="#7C7E7E" />
        {Array.from({length: 7}, (_, i) => (
          <line key={i} x1={768} x2={1098} y1={112 + i * 10} y2={112 + i * 10} stroke="#B3B5B5" strokeWidth={1.5} opacity={0.5} />
        ))}
        <rect x={920} y={102} width={10} height={156} fill={WOOD_DARK} />
        <rect x={752} y={252} width={348} height={18} rx={3} fill={WOOD_DARK} />
        <Fern x={845} y={254} />
        <Buddha x={985} y={254} />
        <path d="M1088 230 C1060 280 1074 330 1060 360" stroke="#3A8A3A" strokeWidth={4} fill="none" />
        <ellipse cx={1066} cy={300} rx={16} ry={9} transform="rotate(-30 1066 300)" fill="#3A8A3A" />
        <ellipse cx={1074} cy={340} rx={16} ry={9} transform="rotate(25 1074 340)" fill="#2F7A32" />
      </g>

      {/* tall white cabinet with a round diffuser on top */}
      <g>
        <ellipse cx={722} cy={738} rx={44} ry={7} fill="#000" opacity={0.15} />
        <circle cx={722} cy={704} r={32} fill="#F4F1E8" />
        <path d="M690 700 H754 A32 32 0 0 1 690 700 Z" fill="#23232A" />
        <rect x={650} y={744} width={150} height={500} fill={WHITE} />
        <rect x={776} y={744} width={24} height={500} fill={WHITE_SHADE} opacity={0.7} />
        <rect x={660} y={756} width={118} height={226} fill="none" stroke={WHITE_SHADE} strokeWidth={3} />
        <rect x={660} y={1000} width={118} height={226} fill="none" stroke={WHITE_SHADE} strokeWidth={3} />
        <rect x={750} y={968} width={12} height={5} rx={2} fill="#B8B0A0" />
      </g>

      {/* wooden skirting */}
      <rect x={0} y={FLOOR_Y - 26} width={W} height={30} fill={WOOD} />
      <rect x={0} y={FLOOR_Y - 26} width={W} height={7} fill="#9A5A32" />

      {/* floor */}
      <Floor />

      {/* armchair with striped cushion */}
      <g>
        <ellipse cx={950} cy={1338} rx={130} ry={14} fill="#000" opacity={0.28} />
        <rect x={846} y={1120} width={210} height={170} rx={70} fill="#1F2124" />
        <rect x={826} y={1218} width={250} height={90} rx={36} fill="#26282C" />
        <rect x={826} y={1196} width={50} height={110} rx={24} fill="#2C2E33" />
        <rect x={1030} y={1196} width={50} height={110} rx={24} fill="#2C2E33" />
        <rect x={850} y={1300} width={14} height={40} fill="#1A1A1C" />
        <rect x={1040} y={1300} width={14} height={40} fill="#1A1A1C" />
        <g transform="rotate(-8 930 1180)">
          <rect x={886} y={1130} width={96} height={92} rx={10} fill="#8F8478" />
          {Array.from({length: 7}, (_, i) => (
            <rect key={i} x={886 + i * 14} y={1130} width={7} height={92} fill="#5A4E43" opacity={0.7} />
          ))}
        </g>
      </g>

      {/* white desk with cups, bottles and a black lamp */}
      <g transform="translate(75 0)">
        <ellipse cx={470} cy={1336} rx={190} ry={13} fill="#000" opacity={0.25} />
        {/* legs + frame */}
        <rect x={300} y={1196} width={9} height={140} fill={WHITE} />
        <rect x={618} y={1196} width={9} height={140} fill={WHITE} />
        <rect x={300} y={1318} width={327} height={7} fill={WHITE} />
        <rect x={300} y={1196} width={327} height={7} fill={WHITE_SHADE} />
        {/* drawers + top */}
        <rect x={296} y={1156} width={335} height={46} rx={3} fill={WHITE} />
        <rect x={296} y={1156} width={335} height={12} fill="#fff" />
        <line x1={464} x2={464} y1={1170} y2={1200} stroke={WHITE_SHADE} strokeWidth={3} />
        <rect x={376} y={1184} width={26} height={4} rx={2} fill="#B8B0A0" />
        <rect x={526} y={1184} width={26} height={4} rx={2} fill="#B8B0A0" />
        {/* things on the desk */}
        {[330, 352, 374, 396, 342, 364, 386, 408].map((x, i) => (
          <Cup key={i} x={x} y={i < 4 ? 1156 : 1146} />
        ))}
        <rect x={436} y={1100} width={22} height={52} rx={4} fill="#E4C53B" />
        <path d="M494 1152 V1112 H512 L520 1090 H532 V1152 Z" fill="#E9EEF1" />
        <rect x={498} y={1124} width={20} height={14} fill="#2F7DB5" />
        <rect x={560} y={1096} width={22} height={56} rx={5} fill="#5B3040" />
        <rect x={566} y={1082} width={10} height={14} fill="#2A2A2C" />
        {/* lamp */}
        <ellipse cx={588} cy={1152} rx={26} ry={5} fill="#1E1E20" />
        <path d="M588 1150 L604 1088 L580 1062" stroke="#1E1E20" strokeWidth={5} fill="none" strokeLinejoin="round" />
        <path d="M562 1058 A28 22 0 0 1 598 1070 Z" fill="#1E1E20" />
      </g>

      {/* black swivel chair */}
      <g transform="translate(45 0)">
        <rect x={604} y={1230} width={9} height={80} fill="#B8B0A0" />
        <path d="M566 1316 H652 M580 1330 L610 1310 L640 1330" stroke="#EDE8DC" strokeWidth={6} strokeLinecap="round" fill="none" />
        <rect x={574} y={1210} width={92} height={26} rx={13} fill="#1D1E21" />
        <path d="M652 1218 C676 1160 668 1100 640 1052 L618 1062 C640 1110 640 1160 624 1214 Z" fill="#26282C" />
      </g>

      {/* treatment bed: navy padded table with a white paper roll */}
      <g>
        <ellipse cx={690} cy={1778} rx={380} ry={30} fill="#000" opacity={0.28} />
        <path d="M560 1300 H790 L1010 1760 H360 Z" fill={NAVY} stroke={NAVY_HI} strokeWidth={26} strokeLinejoin="round" />
        <path d="M590 1304 H765 L915 1750 H450 Z" fill="#F8F5EE" />
        {[0.22, 0.42, 0.62, 0.82].map((t, i) => (
          <line
            key={i}
            x1={590 + (450 - 590) * 0 + (765 - 590) * t}
            y1={1304}
            x2={450 + (915 - 450) * t}
            y2={1750}
            stroke="#D6CEBB"
            strokeWidth={2}
            strokeDasharray="3 9"
          />
        ))}
        <path d="M360 1780 H1010 V1810 H360 Z" fill="#1E232C" />
        <path d="M450 1748 H915" stroke="#fff" strokeWidth={4} opacity={0.5} />
      </g>

      {/* soft room light + vignette */}
      <rect width={W} height={H} fill="url(#vign)" />
      <g style={{mixBlendMode: 'screen'}}>
        {Array.from({length: 18}, (_, i) => (
          <circle
            key={i}
            cx={(random(`dx${i}`) * W + frame * 0.3 * (0.5 + random(`dv${i}`))) % W}
            cy={300 + random(`dy${i}`) * 1000 + Math.sin(frame / 30 + i) * 14}
            r={2 + random(`dr${i}`) * 3}
            fill="#FFF3D0"
            opacity={0.4}
          />
        ))}
      </g>
    </svg>
  );
};
