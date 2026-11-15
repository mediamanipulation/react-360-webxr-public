// The solar system example from ../../../examples/solar-system, on the
// modern runtime. Its React code is loaded from there unchanged. This file
// sets the scene up, and Planet.jsx replaces the example's custom view.

import {Location, ReactInstance} from 'react-360-web';
import '../../../examples/solar-system/index.js';
import {PANEL_SIZE} from '../../../examples/solar-system/constants.js';
import {createPanelSurface} from '../../../examples/shared/client/panelSurface.js';
import {skyDataURL} from '../../../examples/shared/client/sky.js';
import {withEmulator} from '../emulate.js';
import Planet from './Planet.jsx';

withEmulator().then(options => {
  const r360 = new ReactInstance(document.getElementById('container'), {
    fullScreen: true,
    // What the app's requireNativeComponent('Planet') draws
    customViews: [{name: 'Planet', view: Planet}],
    ...options,
  });

  // The Sun sits in front of the viewer, who stands between the orbits of
  // Mars and Jupiter, looking down on the orbits a little. The panel floats
  // above the orbits, so no planet passes in front of it.
  r360.renderToLocation(r360.createRoot('SolarSystem'), new Location([0, -0.75, -3.8]));
  r360.renderToSurface(
    r360.createRoot('PlanetInfo'),
    createPanelSurface({
      ...PANEL_SIZE,
      yaw: 0.4,
      pitch: 0.16,
      distance: 1.6,
      density: 6400,
    }),
  );
  r360.compositor.setBackground(skyDataURL({top: '#02030a', bottom: '#0b1030', stars: 1500}));

  window.r360 = r360;
});
