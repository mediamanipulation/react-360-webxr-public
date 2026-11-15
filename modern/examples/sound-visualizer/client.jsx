// The sound visualizer example from ../../../examples/sound-visualizer, on
// the modern runtime. Everything is loaded from there unchanged: its React
// code, its custom view, its native module and its synthesizer. Only this
// file is new.

import {Location, ReactInstance} from 'react-360-web';
import '../../../examples/sound-visualizer/index.js';
import {engine} from '../../../examples/sound-visualizer/client/engine.js';
import SoundColumnsView from '../../../examples/sound-visualizer/client/SoundColumnsView.js';
import SynthModule from '../../../examples/sound-visualizer/client/SynthModule.js';
import {PANEL_SIZE} from '../../../examples/sound-visualizer/constants.js';
import {createPanelSurface} from '../../../examples/shared/client/panelSurface.js';
import {skyDataURL} from '../../../examples/shared/client/sky.js';
import {withEmulator} from '../emulate.js';

// The viewer's head: from the WebXR viewer pose in VR, and from the camera on
// the page
function updateListener(r360) {
  const frame = r360.vrState.getFrame();
  const space = r360.vrState.getReferenceSpace();
  const pose = frame && space && frame.getViewerPose(space);
  if (pose) {
    const {position: p, orientation: o} = pose.transform;
    engine.updateListener([p.x, p.y, p.z], [o.x, o.y, o.z, o.w]);
    return;
  }
  const camera = r360.compositor.getCamera();
  if (camera) {
    engine.updateListener(camera.position.toArray(), camera.quaternion.toArray());
  }
}

withEmulator().then(options => {
  const r360 = new ReactInstance(document.getElementById('container'), {
    fullScreen: true,
    customViews: [{name: 'SoundColumns', view: SoundColumnsView}],
    nativeModules: [() => new SynthModule()],
    // The listener follows the viewer's head every frame
    frame: () => updateListener(r360),
    ...options,
  });

  // Browsers only start audio during a click or key press
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

  window.r360 = r360;
});
