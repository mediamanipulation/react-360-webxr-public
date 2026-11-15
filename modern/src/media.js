// React 360's AudioModule, VideoModule and Environment, on the browser's own
// media elements and Web Audio.

import {background, sourceURL} from './state.js';

// --- Audio ---------------------------------------------------------------

let context = null;

// Created on first use. Browsers keep it silent until a click or key press.
function audioContext() {
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
    const resume = () => {
      if (context.state === 'suspended') {
        context.resume();
      }
    };
    document.addEventListener('pointerdown', resume);
    document.addEventListener('keydown', resume);
  }
  return context;
}

/**
 * Keeps the listener at the viewer's head, so sounds with a position are
 * heard from where they are. Called every frame by the runtime.
 * `position` is [x, y, z], `forward` and `up` are unit vectors.
 */
export function updateAudioListener(position, forward, up) {
  if (!context) {
    return;
  }
  const listener = context.listener;
  if (listener.positionX) {
    listener.positionX.value = position[0];
    listener.positionY.value = position[1];
    listener.positionZ.value = position[2];
    listener.forwardX.value = forward[0];
    listener.forwardY.value = forward[1];
    listener.forwardZ.value = forward[2];
    listener.upX.value = up[0];
    listener.upY.value = up[1];
    listener.upZ.value = up[2];
  } else {
    listener.setPosition(position[0], position[1], position[2]);
    listener.setOrientation(forward[0], forward[1], forward[2], up[0], up[1], up[2]);
  }
}

// One sound: an <audio> element, through a volume control and, for sounds
// with a place in the world, a panner
class Sound {
  constructor(options = {}) {
    const ctx = audioContext();
    this.element = new Audio();
    this.element.crossOrigin = 'anonymous';
    this.gain = ctx.createGain();
    this.panner = null;
    ctx.createMediaElementSource(this.element).connect(this.gain);
    this.gain.connect(ctx.destination);
    this.set(options);
  }

  set({source, volume, muted, loop, is3d, position} = {}) {
    const url = sourceURL(source);
    if (url) {
      this.element.src = url;
    }
    if (typeof volume === 'number') {
      this.gain.gain.value = volume;
    }
    if (typeof muted === 'boolean') {
      this.element.muted = muted;
    }
    if (typeof loop === 'boolean') {
      this.element.loop = loop;
    }
    if (is3d && !this.panner) {
      const ctx = audioContext();
      this.panner = ctx.createPanner();
      this.panner.panningModel = 'HRTF';
      this.gain.disconnect();
      this.gain.connect(this.panner);
      this.panner.connect(ctx.destination);
    }
    if (position && this.panner) {
      if (this.panner.positionX) {
        this.panner.positionX.value = position[0];
        this.panner.positionY.value = position[1];
        this.panner.positionZ.value = position[2];
      } else {
        this.panner.setPosition(position[0], position[1], position[2]);
      }
    }
  }

  play() {
    // Refused before the first click or key press
    this.element.play().catch(() => {});
  }

  destroy() {
    this.element.pause();
    this.element.removeAttribute('src');
    this.gain.disconnect();
    if (this.panner) {
      this.panner.disconnect();
    }
  }
}

const sounds = new Map();
let environmental = null;

export const AudioModule = {
  /**
   * Prepare a sound under a name of your choosing. Options: source, volume,
   * loop, muted, autoPlay, and for a sound with a place in the world,
   * `is3d: true` and `position: [x, y, z]`.
   */
  createAudio(handle, options = {}) {
    AudioModule.destroy(handle);
    const sound = new Sound(options);
    sounds.set(handle, sound);
    if (options.autoPlay) {
      sound.play();
    }
  },

  play(handle, options) {
    const sound = sounds.get(handle);
    if (sound) {
      sound.set(options);
      sound.play();
    }
  },

  pause(handle) {
    const sound = sounds.get(handle);
    if (sound) {
      sound.element.pause();
    }
  },

  stop(handle) {
    const sound = sounds.get(handle);
    if (sound) {
      sound.element.pause();
      sound.element.currentTime = 0;
    }
  },

  /** Move to a time, in seconds. */
  seek(handle, time) {
    const sound = sounds.get(handle);
    if (sound) {
      sound.element.currentTime = time;
    }
  },

  setParams(handle, options) {
    const sound = sounds.get(handle);
    if (sound) {
      sound.set(options);
    }
  },

  destroy(handle) {
    const sound = sounds.get(handle);
    if (sound) {
      sound.destroy();
      sounds.delete(handle);
    }
  },

  /** Loop a sound as the ambience of the scene. */
  playEnvironmental(options = {}) {
    AudioModule.stopEnvironmental();
    if (!sourceURL(options.source)) {
      return;
    }
    environmental = new Sound({loop: true, ...options});
    environmental.play();
  },

  setEnvironmentalParams(options) {
    if (environmental) {
      environmental.set(options);
    }
  },

  stopEnvironmental() {
    if (environmental) {
      environmental.destroy();
      environmental = null;
    }
  },

  /** Play a short sound once, like a click. */
  playOneShot(options = {}) {
    if (!sourceURL(options.source)) {
      return;
    }
    const sound = new Sound(options);
    sound.element.addEventListener('ended', () => sound.destroy());
    sound.play();
  },
};

// --- Video ---------------------------------------------------------------

const players = new Map();

class VideoPlayer {
  constructor(name) {
    this.name = name;
    this.element = document.createElement('video');
    this.element.crossOrigin = 'anonymous';
    this.element.playsInline = true;
    this.stereo = '2D';
    this._listeners = new Set();
    const report = status => () =>
      this._listeners.forEach(listener => listener({player: name, status}));
    this.element.addEventListener('playing', report('playing'));
    this.element.addEventListener('pause', report('paused'));
    this.element.addEventListener('ended', report('finished'));
    this.element.addEventListener('waiting', report('stalled'));
    this.element.addEventListener('error', report('failed'));
  }

  play({source, stereo, muted = true, volume = 1, autoPlay = true, startPosition = 0} = {}) {
    const url = sourceURL(source);
    if (url) {
      this.element.src = url;
    }
    if (stereo) {
      this.stereo = stereo;
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

// --- Environment ---------------------------------------------------------

export const Environment = {
  /**
   * Show a 360 photo around the viewer. `format` is '2D' for an ordinary
   * panorama, or '3DTB', '3DBT' or '3DLR' for a stereo one whose two eyes
   * are stacked or side by side in the picture.
   */
  setBackgroundImage(source, options = {}) {
    const url = sourceURL(source);
    background.set(url ? {type: 'image', url, format: options.format || '2D'} : null);
  },

  /** Show the video of a VideoModule player around the viewer. */
  setBackgroundVideo(playerName, options = {}) {
    const player = players.get(playerName);
    if (!player) {
      console.warn(`react-360: there is no video player named "${playerName}"`);
      return;
    }
    background.set({type: 'video', player, format: options.format || player.stereo || '2D'});
  },

  clearBackground() {
    background.set(null);
  },
};
