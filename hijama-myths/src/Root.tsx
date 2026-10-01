import React from 'react';
import {Composition} from 'remotion';
import {EpisodeVideo} from './Episode';
import {episodes} from './episodes';
import {DURATION, FPS} from './timing';
import {H, W} from './theme';

// One composition per entry in episodes.ts — ids are myth-01, myth-02, ...
export const RemotionRoot: React.FC = () => (
  <>
    {episodes.map((episode) => (
      <Composition
        key={episode.episodeNumber}
        id={`myth-${String(episode.episodeNumber).padStart(2, '0')}`}
        component={EpisodeVideo}
        durationInFrames={DURATION}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{episode}}
      />
    ))}
  </>
);
