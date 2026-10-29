// How far, in CSS pixels, the mouse may move between press and release for
// the release to count as a click rather than a drag to look around
export const CLICK_SLOP_PX = 5;

// `down` and `up` are [x, y]; `down` is null when no press was recorded
export function isClick(down, up) {
  return down != null && Math.hypot(up[0] - down[0], up[1] - down[1]) <= CLICK_SLOP_PX;
}
