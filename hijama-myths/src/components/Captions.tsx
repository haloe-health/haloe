import React from 'react';
import {C, FONT_SANS, SAFE_BOTTOM} from '../theme';
import {FPS} from '../timing';
import {prog, easeOut} from '../anim';
import type {Caption} from '../episodes';

// Subtitle box lives between y=1440 and y=SAFE_BOTTOM (1670) — clear of the Reels/TikTok UI.
const BOX_TOP = 1450;

export const Captions: React.FC<{captions: Caption[]; frame: number}> = ({captions, frame}) => {
  const cur = captions.find((c) => frame >= c.from * FPS - 2 && frame <= c.to * FPS + 4);
  if (!cur) return null;
  const a = cur.from * FPS;
  const b = cur.to * FPS;
  const inP = prog(frame, a, a + 6, easeOut);
  const outP = 1 - prog(frame, b - 3, b + 3);
  const o = Math.min(inP, outP);
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: BOX_TOP,
        height: SAFE_BOTTOM - BOX_TOP,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: o,
        transform: `translateY(${(1 - inP) * 16}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          padding: '22px 42px',
          borderRadius: 34,
          background: 'rgba(4, 42, 32, 0.8)',
          border: `2px solid ${C.gold}66`,
          color: C.ivory,
          fontFamily: FONT_SANS,
          fontWeight: 700,
          fontSize: 58,
          lineHeight: 1.25,
          textAlign: 'center',
          textWrap: 'balance' as const,
          textShadow: '0 2px 10px rgba(0,0,0,0.35)',
        }}
      >
        {cur.text}
      </div>
    </div>
  );
};
