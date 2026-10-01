import type {IconName} from './components/Icons';

export type Caption = {from: number; to: number; text: string}; // seconds

export type Episode = {
  episodeNumber: number;
  totalEpisodes: number;
  /** Big text over the forest, 0.0-3.5s */
  hook: string;
  /** Text that replaces the hook after the discovery beat, 3.5-5.5s */
  beat: string;
  /** Text on the sign above the door */
  signText: string;
  /** Small heading on the infographic panel */
  panelTitle: string;
  /** Infographic points. "Title → result" — the arrow splits the two lines. */
  points: {icon: IconName; text: string}[];
  /** The client's speech bubble (last beat of the panel) */
  quote: string;
  /** Burned-in subtitles (seconds). Keep out of the top 200px / bottom 250px. */
  captions: Caption[];
  tagline: string;
  cta: string;
  seriesLabel: string;
};

export const episodes: Episode[] = [
  {
    episodeNumber: 1,
    totalEpisodes: 8,
    hook: 'Hijama hurts.',
    beat: 'Does it though?',
    signText: 'haloe Home',
    panelTitle: 'What it really feels like',
    points: [
      {icon: 'cup', text: 'The cups → a firm pull'},
      {icon: 'line', text: 'The incisions → light scratches'},
    ],
    quote: 'Wait… was that it?',
    captions: [
      {from: 0.2, to: 1.9, text: 'Hijama hurts.'},
      {from: 3.55, to: 5.1, text: 'Does it though?'},
      {from: 5.2, to: 7.0, text: 'Most-asked question, honest answer.'},
      {from: 7.2, to: 9.0, text: 'The cups feel like a firm pull.'},
      {from: 9.0, to: 10.7, text: 'The incisions feel like light scratches.'},
      {
        from: 10.7,
        to: 12.45,
        text: 'And what do first-timers say after? “Wait, was that it?”',
      },
    ],
    tagline: 'Rooted in Sunnah. Backed by science.',
    cta: 'Book: haloe.health/book',
    seriesLabel: 'Hijama Myths 1/8 · More in FAQs',
  },
];
