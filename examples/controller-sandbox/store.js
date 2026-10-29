import {createStore} from '../shared/store';
import {COLORS} from '../shared/palette';

// Shared by the 3D scene and the panel, which are separate React roots
export const store = createStore({kind: 'cube', color: COLORS.accent});
