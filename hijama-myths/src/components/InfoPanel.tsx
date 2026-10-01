import React from 'react';
import {C, FONT_SANS, FONT_SERIF, H, W} from '../theme';
import {easeOut, easeOutBack, prog} from '../anim';
import {IconBadge} from './Icons';
import type {Episode} from '../episodes';
import {T} from '../timing';

export const PANEL = {x: 450, y: 300, w: 580, headerH: 100, rowH: 190};

/** Frame at which each row appears. */
export const rowStart = (i: number, nPoints: number) =>
  i < nPoints ? (i === 0 ? T.point1 : T.point2) : T.quote;

const Row: React.FC<{
  index: number;
  total: number;
  frame: number;
  children: React.ReactNode;
}> = ({index, total, frame, children}) => {
  const start = rowStart(index, total - 1);
  const p = prog(frame, start, start + 14, easeOut);
  const accent = prog(frame, start + 6, start + 22, easeOut);
  const cy = PANEL.headerH + index * PANEL.rowH + PANEL.rowH / 2;
  return (
    <g opacity={p} transform={`translate(${(1 - p) * 60} 0)`}>
      {index > 0 && (
        <line x1={32} x2={PANEL.w - 32} y1={cy - PANEL.rowH / 2} y2={cy - PANEL.rowH / 2} stroke={C.ivoryShade} strokeWidth={2} />
      )}
      {/* gold accent line */}
      <rect x={0} y={cy - 46} width={7} height={92 * accent} rx={3.5} fill={C.gold} />
      <g transform={`translate(0 ${cy})`}>{children}</g>
    </g>
  );
};

/** Smiling client avatar (sage hijab), centred on origin. */
const Client: React.FC = () => (
  <g>
    <circle r={58} fill="#DCE8DD" />
    <path d="M-52 40 Q0 70 52 40 Q60 -52 0 -58 Q-60 -52 -52 40 Z" fill="#8FAF98" />
    <ellipse cx={0} cy={-2} rx={31} ry={37} fill="#D3A785" />
    <path d="M-34 -14 C-34 -42 -16 -48 0 -48 C16 -48 34 -42 34 -14 C20 -34 -20 -34 -34 -14 Z" fill="#8FAF98" />
    <ellipse cx={-12} cy={-6} rx={4} ry={5.5} fill="#2B1D16" />
    <ellipse cx={12} cy={-6} rx={4} ry={5.5} fill="#2B1D16" />
    <path d="M-13 12 Q0 26 13 12" stroke="#A65A4D" strokeWidth={4} fill="none" strokeLinecap="round" />
    <circle cx={-22} cy={8} r={7} fill="#E08A72" opacity={0.3} />
    <circle cx={22} cy={8} r={7} fill="#E08A72" opacity={0.3} />
  </g>
);

export const InfoPanel: React.FC<{episode: Episode; frame: number}> = ({episode, frame}) => {
  const n = episode.points.length;
  const total = n + 1;
  const pIn = prog(frame, T.panelIn, T.panelIn + 16, easeOutBack);
  const pFade = prog(frame, T.panelIn, T.panelIn + 10, easeOut);
  // card grows as each row arrives, so it never looks empty
  let rowsShown = 0;
  for (let i = 0; i < total; i++) rowsShown += prog(frame, rowStart(i, n) - 4, rowStart(i, n) + 14, easeOut);
  const h = PANEL.headerH + PANEL.rowH * rowsShown + 20;
  const qStart = T.quote;
  const bubble = prog(frame, qStart + 4, qStart + 18, easeOutBack);
  const parts = episode.quote.split('… ');
  const quoteLines =
    parts.length > 1 ? [`“${parts[0]}…`, `${parts.slice(1).join('… ')}”`] : [`“${episode.quote}”`];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
      <g transform={`translate(${PANEL.x + (1 - pIn) * 90} ${PANEL.y})`} opacity={pFade}>
        <rect x={6} y={14} width={PANEL.w} height={h} rx={40} fill="#000" opacity={0.28} />
        <rect width={PANEL.w} height={h} rx={40} fill={C.ivory} />
        <rect x={2} y={2} width={PANEL.w - 4} height={h - 4} rx={38} fill="none" stroke={C.gold} strokeOpacity={0.7} strokeWidth={3} />
        {/* header */}
        <text x={PANEL.w / 2} y={62} textAnchor="middle" fontFamily={FONT_SANS} fontSize={30} fontWeight={600} letterSpacing={3} fill={C.goldDeep}>
          {episode.panelTitle.toUpperCase()}
        </text>
        <line x1={PANEL.w / 2 - 50} x2={PANEL.w / 2 + 50} y1={80} y2={80} stroke={C.gold} strokeWidth={3} strokeLinecap="round" />

        {episode.points.map((pt, i) => {
          const [title, rest] = pt.text.split('→').map((s) => s.trim());
          return (
            <Row key={i} index={i} total={total} frame={frame}>
              <g transform="translate(92 0)">
                <IconBadge name={pt.icon} r={56} />
              </g>
              <text x={176} y={rest ? -6 : 12} fontFamily={FONT_SERIF} fontSize={46} fontWeight={700} fill={C.emeraldDeep}>
                {title}
              </text>
              {rest && (
                <text x={176} y={44} fontFamily={FONT_SANS} fontSize={38} fontWeight={500} fill={C.emerald}>
                  <tspan fill={C.gold} fontWeight={700}>→ </tspan>
                  {rest}
                </text>
              )}
              <rect x={176} y={rest ? 62 : 30} width={90 * prog(frame, rowStart(i, n) + 8, rowStart(i, n) + 24, easeOut)} height={4} rx={2} fill={C.gold} />
            </Row>
          );
        })}

        <Row index={n} total={total} frame={frame}>
          <g transform="translate(92 0)">
            <Client />
          </g>
          <g transform="translate(176 0)">
           <g transform={`scale(${bubble})`}>
            <path d="M-4 -4 L-26 6 L2 20 Z" fill="#fff" />
            <rect x={0} y={-66} width={372} height={132} rx={30} fill="#fff" stroke={C.gold} strokeWidth={3} />
            {quoteLines.map((ln, i) => (
              <text
                key={i}
                x={186}
                y={quoteLines.length === 1 ? 14 : i === 0 ? -4 : 42}
                textAnchor="middle"
                fontFamily={FONT_SERIF}
                fontStyle="italic"
                fontSize={42}
                fill={C.emeraldDeep}
              >
                {ln}
              </text>
            ))}
           </g>
          </g>
        </Row>
      </g>
    </svg>
  );
};
