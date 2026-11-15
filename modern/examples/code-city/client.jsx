// The code city example from ../../../examples/code-city, on the modern
// runtime. Its React code is loaded from there unchanged: only this file,
// which sets the scene up, is written for the new runtime.

import {Location, ReactInstance} from 'react-360-web';
import '../../../examples/code-city/index.js';
import {PANEL_SIZE} from '../../../examples/code-city/constants.js';
import {createPanelSurface} from '../../../examples/shared/client/panelSurface.js';
import {skyDataURL} from '../../../examples/shared/client/sky.js';
import {withEmulator} from '../emulate.js';

withEmulator().then(options => {
  const r360 = new ReactInstance(document.getElementById('container'), {
    fullScreen: true,
    ...options,
  });

  // The viewer stands in the plaza at the middle of the city
  r360.renderToLocation(r360.createRoot('CodeCity'), new Location([0, 0, 0]));
  r360.renderToSurface(
    r360.createRoot('CityPanel'),
    createPanelSurface({...PANEL_SIZE, yaw: 0, pitch: -0.27, distance: 1.4, density: 6400}),
  );
  r360.compositor.setBackground(skyDataURL({top: '#0a0f24', bottom: '#1c2a4a', stars: 300}));

  window.r360 = r360;
});
