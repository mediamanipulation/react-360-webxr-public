import {Location, ReactInstance} from 'react-360-web';
import {createPanelSurface} from '../shared/client/panelSurface';
import {skyDataURL} from '../shared/client/sky';
import PlanetView from './client/PlanetView';
import {PANEL_SIZE} from './constants';

function init(bundle, parent, options = {}) {
  const r360 = new ReactInstance(bundle, parent, {
    fullScreen: true,
    customViews: [{name: 'Planet', view: PlanetView}],
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

  return r360;
}

window.React360 = {init};
