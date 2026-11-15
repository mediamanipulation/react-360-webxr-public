// With ?emulate in the address, installs IWER (Meta's Immersive Web
// Emulation Runtime) as an emulated Quest 3, so an example can enter VR
// without a headset. The device is exposed as window.xrDevice. Resolves with
// the ReactInstance options the emulator needs.
export async function withEmulator() {
  if (!/[?&]emulate\b/.test(location.search)) {
    return {};
  }
  const {XRDevice, metaQuest3} = await import('iwer');
  window.xrDevice = new XRDevice(metaQuest3);
  // Desktop browsers expose a native navigator.xr even with no headset
  window.xrDevice.installRuntime({forceInstall: true});
  // Left on, the emulated browser would start VR without the button
  return {offerSession: false};
}
