import {Surface} from 'react-360-web';

// A flat panel surface, turned by `yaw` (left/right) and `pitch` (up/down)
// radians around the viewer
export function createPanelSurface({width, height, yaw = 0, pitch = 0}) {
  const surface = new Surface(width, height, Surface.SurfaceShape.Flat);
  surface.setAngle(yaw, pitch);
  return surface;
}
