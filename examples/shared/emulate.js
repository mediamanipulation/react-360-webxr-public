// With ?emulate in the URL, loads IWER, Meta's WebXR emulator, as an emulated
// Quest 3 so a demo can enter VR without a headset. The emulated device is
// window.xrDevice. Load this before the demo's client bundle.
if (location.search.indexOf('emulate') >= 0) {
  document.write('<script src="../node_modules/iwer/build/iwer.min.js"></script>');
  document.write(
    '<script>' +
      'if (window.IWER) {' +
      '  window.xrDevice = new IWER.XRDevice(IWER.metaQuest3);' +
      '  window.xrDevice.installRuntime({forceInstall: true});' +
      '}' +
      '</script>',
  );
}
