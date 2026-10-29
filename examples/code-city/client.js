import {Location, ReactInstance} from 'react-360-web';
import {createPanelSurface} from '../shared/client/panelSurface';
import {skyDataURL} from '../shared/client/sky';
import {PANEL_SIZE} from './constants';

function init(bundle, parent, options = {}) {
  const r360 = new ReactInstance(bundle, parent, {
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

  return r360;
}

window.React360 = {init};
