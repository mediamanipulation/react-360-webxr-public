import {Surface} from 'react-360-web';

// React 360 places flat surfaces 4 m away, with 4680 pixels to a full circle
const DEFAULT_DENSITY = 4680;

// A flat panel surface, turned by `yaw` (left/right) and `pitch` (up/down)
// radians around the viewer, `distance` meters away. Moving a panel closer
// keeps its apparent size, so it can sit in front of a scene's 3D content; a
// higher `density` (pixels per full circle) makes it look smaller.
export function createPanelSurface({
  width,
  height,
  yaw = 0,
  pitch = 0,
  distance = 4,
  density = DEFAULT_DENSITY,
}) {
  const surface = new Surface(width, height, Surface.SurfaceShape.Flat);
  surface.setRadius(distance);
  // setRadius only moves a flat surface; this rebuilds it at the new radius
  surface.setDensity(density);
  surface.setAngle(yaw, pitch);
  return surface;
}
