// React 360's AudioModule, VideoModule and Environment, on the browser's own
// media elements.

import {background, sourceURL} from './state.js';

let environmental = null;

export const AudioModule = {
  /** Loop a sound as the ambience of the scene. */
  playEnvironmental({source, volume = 1, loop = true} = {}) {
    AudioModule.stopEnvironmental();
    const url = sourceURL(source);
    if (!url) {
      return;
    }
    environmental = new Audio(url);
    environmental.loop = loop;
    environmental.volume = volume;
    // Browsers refuse sound before the first click or key press
    environmental.play().catch(() => {});
  },

  setEnvironmentalParams({volume, muted} = {}) {
    if (!environmental) {
      return;
    }
    if (typeof volume === 'number') {
      environmental.volume = volume;
    }
    if (typeof muted === 'boolean') {
      environmental.muted = muted;
    }
  },

  stopEnvironmental() {
    if (environmental) {
      environmental.pause();
      environmental = null;
    }
  },

  /** Play a short sound once, like a click. */
  playOneShot({source, volume = 1} = {}) {
    const url = sourceURL(source);
    if (!url) {
      return;
    }
    const sound = new Audio(url);
    sound.volume = volume;
    sound.play().catch(() => {});
  },
};

const players = new Map();

class VideoPlayer {
  constructor(name) {
    this.name = name;
    this.element = document.createElement('video');
    this.element.crossOrigin = 'anonymous';
    this.element.playsInline = true;
    this._listeners = new Set();
    const report = status => () =>
      this._listeners.forEach(listener => listener({player: name, status}));
    this.element.addEventListener('playing', report('playing'));
    this.element.addEventListener('pause', report('paused'));
    this.element.addEventListener('ended', report('finished'));
    this.element.addEventListener('waiting', report('stalled'));
    this.element.addEventListener('error', report('failed'));
  }

  play({source, muted = true, volume = 1, autoPlay = true, startPosition = 0} = {}) {
    const url = sourceURL(source);
    if (url) {
      this.element.src = url;
    }
    // Unmuted video cannot start without a click, so it is muted by default
    this.element.muted = muted;
    this.element.volume = volume;
    if (startPosition) {
      this.element.currentTime = startPosition / 1000;
    }
    if (autoPlay) {
      this.resume();
    }
  }

  resume() {
    if (this.element.ended) {
      this.element.currentTime = 0;
    }
    this.element.play().catch(() => {});
  }

  pause() {
    this.element.pause();
  }

  stop() {
    this.element.pause();
    this.element.removeAttribute('src');
    this.element.load();
  }

  seek(timeMs) {
    this.element.currentTime = timeMs / 1000;
  }

  setMuted(muted) {
    this.element.muted = muted;
  }

  setVolume(volume) {
    this.element.volume = volume;
  }

  /** 'onVideoStatusChanged' is the one event players send. */
  addListener(type, listener) {
    this._listeners.add(listener);
    return {remove: () => this._listeners.delete(listener)};
  }

  destroy() {
    this.stop();
    this._listeners.clear();
    players.delete(this.name);
  }
}

export const VideoModule = {
  createPlayer(name) {
    if (!players.has(name)) {
      players.set(name, new VideoPlayer(name));
    }
    return players.get(name);
  },
  getPlayer: name => players.get(name) || null,
  destroyPlayer(name) {
    const player = players.get(name);
    if (player) {
      player.destroy();
    }
  },
};

export const Environment = {
  /** Show a 360 photo around the viewer. */
  setBackgroundImage(source, options = {}) {
    const url = sourceURL(source);
    background.set(url ? {type: 'image', url, format: options.format || '2D'} : null);
  },

  /** Show the video of a VideoModule player around the viewer. */
  setBackgroundVideo(playerName) {
    const player = players.get(playerName);
    if (!player) {
      console.warn(`react-360: there is no video player named "${playerName}"`);
      return;
    }
    background.set({type: 'video', player});
  },

  clearBackground() {
    background.set(null);
  },
};
