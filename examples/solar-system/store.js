import {createStore} from '../shared/store';

// Shared by the 3D scene and the info panel, which are separate React roots
export const store = createStore({hovered: null, selected: 'Earth', speed: 1});
