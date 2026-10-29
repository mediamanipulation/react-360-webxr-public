// Size of the info panel's surface in pixels, shared by client.js (which
// creates the surface) and the React panel (which must fill it exactly)
export const PANEL_SIZE = {width: 600, height: 520};

// The panel's speed buttons. Faster than 10× and the inner planets jump so
// far each frame that they seem to stutter or run backwards.
export const SPEEDS = [
  {label: 'Pause', value: 0},
  {label: '¼×', value: 0.25},
  {label: '1×', value: 1},
  {label: '10×', value: 10},
];
