// The controller sandbox example from ../../../examples/controller-sandbox,
// on the modern runtime. Everything is loaded from there unchanged: its React
// code, its custom view (a class drawing with three.js), its native module
// and the code that launches shapes. Only this file is new.

import {Location, ReactInstance} from 'react-360-web';
import '../../../examples/controller-sandbox/index.js';
import SandboxModule from '../../../examples/controller-sandbox/client/SandboxModule.js';
import SandboxView from '../../../examples/controller-sandbox/client/SandboxView.js';
import {world} from '../../../examples/controller-sandbox/client/world.js';
import {PANEL_SIZE} from '../../../examples/controller-sandbox/constants.js';
import {createPanelSurface} from '../../../examples/shared/client/panelSurface.js';
import {skyDataURL} from '../../../examples/shared/client/sky.js';
import {withEmulator} from '../emulate.js';

withEmulator().then(async options => {
  const r360 = new ReactInstance(document.getElementById('container'), {
    fullScreen: true,
    customViews: [{name: 'SandboxField', view: SandboxView}],
    nativeModules: [ctx => new SandboxModule(ctx)],
    ...options,
  });

  r360.renderToLocation(r360.createRoot('SandboxScene'), new Location([0, 0, 0]));
  // Low and close, so shapes launched straight ahead fly over it
  r360.renderToSurface(
    r360.createRoot('SandboxPanel'),
    createPanelSurface({...PANEL_SIZE, yaw: 0, pitch: -0.3, distance: 1.5, density: 6400}),
  );
  r360.compositor.setBackground(skyDataURL({top: '#0b0820', bottom: '#1a1033', stars: 600}));

  window.r360 = r360;
  // The world listens to the canvas, which exists once the scene is up
  await r360.whenReady();
  world.attach(r360);
  // For experimenting from the browser console
  window.sandboxWorld = world;
});
