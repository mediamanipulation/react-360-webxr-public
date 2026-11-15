// This file contains the boilerplate to execute your React app.
// If you want to modify your application's content, start in "index.jsx"

import {ReactInstance} from 'react-360-web';
import './index.jsx';

async function init(parent, options = {}) {
  // Open with ?emulate to try VR without a headset: IWER (Meta's Immersive
  // Web Emulation Runtime) installs an emulated Quest 3 as navigator.xr.
  // The device is exposed as window.xrDevice for scripting it.
  if (/[?&]emulate\b/.test(location.search)) {
    const {XRDevice, metaQuest3} = await import('iwer');
    window.xrDevice = new XRDevice(metaQuest3);
    // Desktop browsers expose a native navigator.xr even with no headset
    window.xrDevice.installRuntime({forceInstall: true});
    // Left on, the emulated browser would start VR without the button
    options = {...options, offerSession: false};
  }

  const r360 = new ReactInstance(parent, {
    // Add custom options here
    fullScreen: true,
    ...options,
  });

  // Render your app content to the default surface
  r360.renderToSurface(
    r360.createRoot('WebXRDemo', { /* initial props */ }),
    r360.getDefaultSurface()
  );

  // Load the initial environment
  r360.compositor.setBackground(r360.getAssetURL('360_world.jpg'));

  return r360;
}

init(document.getElementById('container'), {assetRoot: 'static_assets/'}).then(r360 => {
  window.r360 = r360;
});
