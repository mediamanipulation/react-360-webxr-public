import {Location, ReactInstance} from 'react-360-web';
import {createPanelSurface} from '../shared/client/panelSurface';
import {skyDataURL} from '../shared/client/sky';
import {engine} from './client/engine';
import SoundColumnsView from './client/SoundColumnsView';
import SynthModule from './client/SynthModule';
import {PANEL_SIZE} from './constants';

// The viewer's head: from the WebXR viewer pose in VR (the main camera stays
// still while each eye gets its own), and from the camera on desktop
function updateListener(r360) {
  const frame = r360.vrState.getFrame();
  const pose = frame && frame.getViewerPose(r360.vrState.getReferenceSpace());
  if (pose) {
    const {position: p, orientation: o} = pose.transform;
    engine.updateListener([p.x, p.y, p.z], [o.x, o.y, o.z, o.w]);
  } else {
    const camera = r360.compositor.getCamera();
    engine.updateListener(camera.position.toArray(), camera.quaternion.toArray());
  }
}

function init(bundle, parent, options = {}) {
  const r360 = new ReactInstance(bundle, parent, {
    fullScreen: true,
    customViews: [{name: 'SoundColumns', view: SoundColumnsView}],
    nativeModules: [() => new SynthModule()],
    // The listener follows the viewer's head every frame
    frame: () => updateListener(r360),
    ...options,
  });

  // Browsers only start audio during a user gesture, and a Play click reaches
  // the engine through the React app's worker, which doesn't count as one
  const unlock = () => engine.unlock();
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
  // For experimenting from the browser console
  window.soundEngine = engine;

  r360.renderToLocation(r360.createRoot('Visualizer'), new Location([0, 0, 0]));
  r360.renderToSurface(
    r360.createRoot('SoundPanel'),
    createPanelSurface({...PANEL_SIZE, yaw: 0, pitch: -0.32, distance: 1.5, density: 6400}),
  );
  r360.compositor.setBackground(skyDataURL({top: '#03040c', bottom: '#101633', stars: 900}));

  return r360;
}

window.React360 = {init};
