import {Module} from 'react-360-web';
import {world} from './world';

// Lets React clear the sandbox, and tells it how many shapes are flying
export default class SandboxModule extends Module {
  constructor(ctx) {
    super('Sandbox');
    world.onCountChange = count => {
      ctx.callFunction('RCTDeviceEventEmitter', 'emit', ['sandboxCountChanged', count]);
    };
  }

  clear() {
    world.clear();
  }
}
