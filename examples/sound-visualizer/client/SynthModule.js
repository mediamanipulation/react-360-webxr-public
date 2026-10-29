import {Module} from 'react-360-web';
import {engine} from './engine';

// Lets the React app control the music, which plays on the main thread
export default class SynthModule extends Module {
  constructor() {
    super('Synth');
  }

  play() {
    engine.play();
  }

  pause() {
    engine.pause();
  }

  setMood(name) {
    engine.setMood(name);
  }

  setVolume(value) {
    engine.setVolume(value);
  }
}
