import React from 'react';
import {Img, staticFile} from 'remotion';
import {C, FONT_SANS, FONT_SERIF, H, W} from '../theme';
import {easeOut, prog} from '../anim';
import type {Episode} from '../episodes';
import {T} from '../timing';

export const EndCard: React.FC<{episode: Episode; frame: number}> = ({episode, frame}) => {
  const t0 = T.endStart;
  const fade = prog(frame, t0, t0 + 12);
  const item = (delay: number) => {
    const p = prog(frame, t0 + delay, t0 + delay + 14, easeOut);
    return {opacity: p, transform: `translateY(${(1 - p) * 30}px)`};
  };
  const flowerScale = 0.9 + 0.1 * prog(frame, t0, t0 + 30, easeOut);
  const [line1, line2] = episode.tagline.split('. ').map((s, i, a) => (i < a.length - 1 ? s + '.' : s));

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        opacity: fade,
        background: `radial-gradient(circle at 50% 28%, #FBF8F1 0%, ${C.ivory} 55%, ${C.ivoryWarm} 100%)`,
      }}
    >
      {/* soft emerald + gold arcs */}
      <svg width={W} height={H} style={{position: 'absolute', inset: 0}}>
        <circle cx={W + 120} cy={-60} r={420} fill={C.emerald} opacity={0.08} />
        <circle cx={-140} cy={H + 40} r={460} fill={C.emerald} opacity={0.08} />
        <circle cx={W + 120} cy={-60} r={330} fill="none" stroke={C.gold} strokeOpacity={0.5} strokeWidth={2} />
        <circle cx={-140} cy={H + 40} r={380} fill="none" stroke={C.gold} strokeOpacity={0.5} strokeWidth={2} />
      </svg>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 330,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div style={{...item(2), transform: `${item(2).transform} scale(${flowerScale})`}}>
          <Img src={staticFile('logo-flower.svg')} style={{width: 210, height: 210}} />
        </div>
        <div
          style={{
            ...item(8),
            marginTop: 6,
            fontFamily: FONT_SERIF,
            fontWeight: 700,
            fontSize: 220,
            letterSpacing: -4,
            color: C.emeraldDeep,
            lineHeight: 1.05,
          }}
        >
          haloe
        </div>
        <div
          style={{
            ...item(12),
            fontFamily: FONT_SANS,
            fontWeight: 600,
            fontSize: 30,
            letterSpacing: 8,
            color: C.goldDeep,
            textTransform: 'uppercase',
          }}
        >
          The Hijama Educator
        </div>
        <div style={{...item(16), width: 120, height: 4, borderRadius: 2, background: C.gold, margin: '44px 0'}} />
        <div
          style={{
            ...item(20),
            fontFamily: FONT_SERIF,
            fontStyle: 'italic',
            fontSize: 64,
            lineHeight: 1.25,
            color: C.emeraldMid,
          }}
        >
          <div>{line1}</div>
          <div>{line2}</div>
        </div>
        <div
          style={{
            ...item(28),
            marginTop: 70,
            padding: '30px 64px',
            borderRadius: 100,
            background: C.emerald,
            color: C.ivory,
            fontFamily: FONT_SANS,
            fontWeight: 700,
            fontSize: 52,
            boxShadow: '0 14px 34px rgba(7, 58, 45, 0.28)',
            border: `3px solid ${C.gold}`,
          }}
        >
          {episode.cta}
        </div>
        <div
          style={{
            ...item(34),
            marginTop: 52,
            fontFamily: FONT_SANS,
            fontWeight: 600,
            fontSize: 36,
            letterSpacing: 1,
            color: C.goldDeep,
          }}
        >
          {episode.seriesLabel}
        </div>
      </div>
    </div>
  );
};
