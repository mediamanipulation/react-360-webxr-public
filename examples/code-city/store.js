import {createStore} from '../shared/store';

// Shared by the city and the panel, which are separate React roots.
// `district` is the folder being shown, or null for all of them.
export const store = createStore({hovered: null, district: null});
