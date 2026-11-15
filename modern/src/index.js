// React 360's API, on React 19, current three.js and WebXR.
// One module stands in for both of the original packages, `react-360` (the
// components) and `react-360-web` (the runtime).

import Animated from './Animated.jsx';
import {ControllerInfo} from './controllers.js';
import {AudioModule, Environment, VideoModule} from './media.js';
import {registerNativeModule} from './state.js';

export {Image, Text, View, VrButton} from './components.jsx';
export {default as ReactInstance, Location, Surface} from './ReactInstance.jsx';
export {
  AmbientLight,
  Box,
  Cylinder,
  DirectionalLight,
  Entity,
  Model,
  Plane,
  PointLight,
  Sphere,
  SpotLight,
} from './three-d.jsx';
export {Module, RCTBaseView} from './legacy.jsx';
export {
  AppRegistry,
  DeviceEventEmitter,
  NativeModules,
  asset,
  requireNativeComponent,
} from './state.js';
export {StyleSheet} from './style.js';
export {Animated, Environment, VideoModule};

// The modules every app has
registerNativeModule({name: 'AudioModule', ...AudioModule});
registerNativeModule({name: 'ControllerInfo', ...ControllerInfo});
registerNativeModule({name: 'VideoModule', ...VideoModule});
