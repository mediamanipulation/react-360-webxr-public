import {Location, ReactInstance} from 'react-360-web';
import {createPanelSurface} from '../shared/client/panelSurface';
import {skyDataURL} from '../shared/client/sky';
import SandboxModule from './client/SandboxModule';
import SandboxView from './client/SandboxView';
import {world} from './client/world';
import {PANEL_SIZE} from './constants';

function init(bundle, parent, options = {}) {
  const r360 = new ReactInstance(bundle, parent, {
    fullScreen: true,
    customViews: [{name: 'SandboxField', view: SandboxView}],
    nativeModules: [ctx => new SandboxModule(ctx)],
    ...options,
  });
  world.attach(r360);

  r360.renderToLocation(r360.createRoot('SandboxScene'), new Location([0, 0, 0]));
  // Low and close, so shapes launched straight ahead fly over it
  r360.renderToSurface(
    r360.createRoot('SandboxPanel'),
    createPanelSurface({...PANEL_SIZE, yaw: 0, pitch: -0.3, distance: 1.5, density: 6400}),
  );
  r360.compositor.setBackground(skyDataURL({top: '#0b0820', bottom: '#1a1033', stars: 600}));

  return r360;
}

window.React360 = {init};
