import {Easing, interpolate} from 'remotion';

export type EaseFn = (t: number) => number;

/** 0..1 progress between frames a and b (clamped), with easing. */
export const prog = (
  f: number,
  a: number,
  b: number,
  ease: EaseFn = Easing.inOut(Easing.cubic),
): number =>
  interpolate(f, [a, b], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ease,
  });

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export const easeOut = Easing.out(Easing.cubic);
export const easeInOut = Easing.inOut(Easing.cubic);
export const easeOutBack = Easing.out(Easing.back(1.6));

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
