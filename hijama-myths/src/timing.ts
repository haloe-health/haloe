export const FPS = 30;
export const DURATION = 450; // exactly 15.0s
export const sec = (s: number) => Math.round(s * FPS);

/** Scene timing, shared by every episode (frames @30fps). */
export const T = {
  // 0.0 - 3.5s  forest walk, hook text
  hookEnd: sec(3.5),
  // 3.5 - 5.5s  discovery, "Does it though?"
  beatEnd: sec(5.5),
  // 5.5 - 7.0s  knock, door opens, camera follows inside
  knock1: sec(5.7),
  knock2: sec(6.1),
  doorOpenStart: sec(6.2),
  doorOpenEnd: sec(6.9),
  pushStart: sec(6.3),
  pushEnd: sec(7.2),
  // 7.0 - 12.5s inside haloe Home
  interiorStart: sec(7.0),
  panelIn: sec(7.1),
  point1: sec(7.5),
  point2: sec(9.2),
  quote: sec(10.8),
  // 12.5 - 15.0s end card
  endStart: sec(12.5),
};
