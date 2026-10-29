import {createStore} from '../shared/store';

// Shared by the 3D scene and the panel, which are separate React roots
export const store = createStore({playing: false, mood: 'chill', volume: 0.7});
