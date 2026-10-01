import React from 'react';
import {AbsoluteFill, Audio, Easing, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {AUDIO} from './audioConfig.generated';
import {C, FONT_SERIF, H, W} from './theme';
import {easeInOut, easeOut, easeOutBack, lerp, prog} from './anim';
import {T} from './timing';
import type {Episode} from './episodes';
import {Forest, GROUND_Y} from './components/Forest';
import {CupHouse, DOOR_CY} from './components/CupHouse';
import {Halima} from './components/Halima';
import {Interior, INTERIOR_FEET_Y} from './components/Interior';
import {InfoPanel} from './components/InfoPanel';
import {Captions} from './components/Captions';
import {EndCard} from './components/EndCard';

// ---- outdoor choreography (frames) ---------------------------------------
const CAM_END = 1300;
const CUP_X = 700; // screen x of the cup house
const HX_START = 200; // where Halima stands while she looks up
const HX_DOOR = 340; // where she stands to knock
const WALK_END = 105;
const camEase = Easing.bezier(0.3, 0.5, 0.4, 1);

const camAt = (f: number) => CAM_END * prog(f, 0, WALK_END, camEase);
const hxAt = (f: number) => {
  const toDoor = prog(f, 138, 165, easeInOut);
  const inside = prog(f, 205, 226, Easing.in(Easing.quad));
  return lerp(lerp(HX_START, HX_DOOR, toDoor), CUP_X, inside);
};
/** total distance she has covered — drives the walk cycle so feet match the ground */
const distAt = (f: number) => camAt(f) + (hxAt(f) - HX_START);

const pulse = (f: number, t: number, w = 3) => Math.exp(-(((f - t) / w) ** 2));

const HookText: React.FC<{text: string; start: number; end: number; frame: number; size: number; italic?: boolean; color: string}> = ({
  text,
  start,
  end,
  frame,
  size,
  italic,
  color,
}) => {
  const inP = prog(frame, start, start + 14, easeOutBack);
  const out = 1 - prog(frame, end - 6, end);
  const o = Math.min(prog(frame, start, start + 8), out);
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: 250,
        textAlign: 'center',
        fontFamily: FONT_SERIF,
        fontWeight: 700,
        fontStyle: italic ? 'italic' : 'normal',
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: -2,
        color,
        opacity: o,
        transform: `scale(${0.88 + 0.12 * inP}) translateY(${(1 - inP) * 24}px)`,
        textShadow: '0 6px 30px rgba(2, 28, 21, 0.55)',
      }}
    >
      {text}
      <div
        style={{
          margin: '26px auto 0',
          height: 6,
          width: 150 * inP,
          borderRadius: 3,
          background: C.gold,
        }}
      />
    </div>
  );
};

const Ripples: React.FC<{frame: number; cx: number; cy: number}> = ({frame, cx, cy}) => (
  <g>
    {[T.knock1, T.knock2].flatMap((t0) =>
      [0, 5].map((d, j) => {
        const p = prog(frame, t0 + d, t0 + d + 16, easeOut);
        if (p <= 0 || p >= 1) return null;
        return (
          <circle
            key={`${t0}-${j}`}
            cx={cx}
            cy={cy}
            r={24 + p * 90}
            fill="none"
            stroke={C.goldBright}
            strokeWidth={6 * (1 - p) + 1}
            opacity={(1 - p) * 0.9}
          />
        );
      }),
    )}
  </g>
);

export const EpisodeVideo: React.FC<{episode: Episode}> = ({episode}) => {
  const f = useCurrentFrame();

  // ---------------- outdoor scene ----------------
  const outdoorVisible = f < 232;
  const cam = camAt(f);
  const hx = hxAt(f);
  const dist = distAt(f);
  const speed = distAt(f) - distAt(f - 1);
  const amp = Math.min(1, Math.max(0, speed / 5));
  const phase = dist / 38;

  const lookUp = -15 * (prog(f, 108, 126, easeInOut) - prog(f, 140, 156, easeInOut));
  const raise = prog(f, 158, 172, easeInOut) - prog(f, 196, 208, easeInOut);
  const knockBeat = 10 * (pulse(f, T.knock1) + pulse(f, T.knock2));
  const walkSwing = Math.sin(phase) * 20 * amp;
  const armFront = lerp(walkSwing, -58, raise) - knockBeat * raise;

  const doorOpen = prog(f, T.doorOpenStart, T.doorOpenEnd, easeInOut);
  const camScale =
    (1 + 0.06 * prog(f, 105, 205, easeInOut)) *
    (1 + 2.5 * prog(f, T.pushStart, T.pushEnd + 4, Easing.in(Easing.cubic)));
  const fadeIn = prog(f, 218, 226);
  const halimaOpacity = 1 - prog(f, 212, 226);
  const cupSignO = prog(f, 80, 100);
  const flash = Math.max(0, prog(f, T.pushStart + 8, T.interiorStart + 6) - prog(f, T.interiorStart + 8, T.interiorStart + 26));

  // ---------------- interior ----------------
  const interiorVisible = f >= T.interiorStart - 6 && f < T.endStart + 20;
  const iF = f - T.interiorStart;
  const interiorO = prog(f, T.interiorStart - 4, T.interiorStart + 12);
  const iZoom = lerp(1.12, 1, prog(f, T.interiorStart, T.interiorStart + 40, easeOut));
  const walkInX = lerp(-170, 250, prog(f, T.interiorStart + 2, T.interiorStart + 36, easeInOut));
  const walkInDist = walkInX;
  const walkSpeed = prog(f + 1, T.interiorStart + 2, T.interiorStart + 36, easeInOut) * 420 - prog(f, T.interiorStart + 2, T.interiorStart + 36, easeInOut) * 420;
  const walkAmp = Math.min(1, Math.max(0, walkSpeed / 5));
  const turn = prog(f, T.interiorStart + 36, T.interiorStart + 48);
  const sideSquash = Math.max(0.02, 1 - turn * 2);
  const frontSquash = Math.max(0.02, turn * 2 - 1);
  const pt = Math.max(
    ...[T.point1, T.point2, T.quote].map((t) => Math.max(0, prog(f, t - 6, t + 4, easeOut) - prog(f, t + 26, t + 40, easeInOut))),
  );
  const pointArm = lerp(7, -112, pt);
  const idleSway = Math.sin(f / 26) * 1.2;

  // ---------------- text ----------------
  return (
    <AbsoluteFill style={{background: C.emeraldInk, overflow: 'hidden'}}>
      {/* OUTDOOR */}
      {outdoorVisible && (
        <AbsoluteFill style={{opacity: 1 - fadeIn}}>
          <AbsoluteFill
            style={{transform: `scale(${camScale})`, transformOrigin: `${CUP_X}px ${GROUND_Y + DOOR_CY + 20}px`}}
          >
            <Forest cam={cam} frame={f} clearingX={CAM_END + CUP_X} camEnd={CAM_END} />
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
              {/* cup house: world x = CAM_END + CUP_X */}
              <CupHouse
                x={CAM_END + CUP_X - cam}
                y={GROUND_Y}
                doorOpen={doorOpen}
                sign={episode.signText}
                signOpacity={cupSignO}
                frame={f}
              />
              <Ripples frame={f} cx={CUP_X - 128} cy={GROUND_Y - 270} />
              <Halima
                view="side"
                x={hx}
                y={GROUND_Y}
                phase={phase}
                amp={amp}
                headTilt={lookUp}
                armFront={armFront}
                opacity={halimaOpacity}
                frame={f}
              />
            </svg>
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {/* INTERIOR */}
      {interiorVisible && (
        <AbsoluteFill style={{opacity: interiorO}}>
          <AbsoluteFill style={{transform: `scale(${iZoom})`, transformOrigin: '50% 60%'}}>
            <Interior frame={f} />
            <InfoPanel episode={episode} frame={f} />
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
              {sideSquash > 0.03 && turn < 0.5 && (
                <Halima
                  view="side"
                  x={walkInX}
                  y={INTERIOR_FEET_Y}
                  phase={walkInDist / 38}
                  amp={walkAmp}
                  armFront={Math.sin(walkInDist / 38) * 20 * walkAmp}
                  squashX={sideSquash}
                  frame={f}
                />
              )}
              {turn >= 0.5 && (
                <Halima
                  view="front"
                  x={250}
                  y={INTERIOR_FEET_Y}
                  armFront={pointArm}
                  headTilt={0}
                  squashX={frontSquash}
                  frame={f}
                />
              )}
            </svg>
          </AbsoluteFill>
        </AbsoluteFill>
      )}

      {/* warm light wash as the camera passes through the door */}
      <AbsoluteFill
        style={{
          opacity: flash,
          background: 'radial-gradient(circle at 50% 62%, #FFF6D6 0%, #FFE2A0 45%, #F4C873 100%)',
        }}
      />

      {/* END CARD */}
      {f >= T.endStart - 1 && <EndCard episode={episode} frame={f} />}

      {/* ON-SCREEN TEXT */}
      {f < T.beatEnd + 10 && (
        <>
          <HookText text={episode.hook} start={6} end={T.hookEnd} frame={f} size={178} color={C.ivory} />
          <HookText text={episode.beat} start={T.hookEnd} end={T.beatEnd} frame={f} size={148} italic color={C.goldBright} />
        </>
      )}
      {f < T.endStart && <Captions captions={episode.captions} frame={f} />}

      {/* AUDIO — optional files in /assets, detected by scripts/detect-audio.mjs */}
      {AUDIO.voiceover && <Audio src={staticFile('voiceover.mp3')} />}
      {AUDIO.music && <Audio src={staticFile('music.mp3')} volume={0.12} />}
      {AUDIO.knock &&
        [T.knock1, T.knock2].map((t) => (
          <Sequence key={t} from={t} durationInFrames={30}>
            <Audio src={staticFile('knock.mp3')} volume={0.5} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};
