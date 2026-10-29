'use strict';

const path = require('path');
const {assetExts} = require('metro-config/src/defaults/defaults');

// These examples run against the React 360 sources in this repository instead of
// the npm packages: the WebXR runtime in ../React360 (react-360-web) and the
// React components in ../Libraries (react-360), which are updated for React
// 16.8 and React Native 0.59. Metro 0.51 does not follow symlinks, so both
// folders are added as watch folders rather than installed as npm `file:`
// dependencies. scripts/hasteImpl.js names the modules in ../Libraries.
const runtimeRoot = path.resolve(__dirname, '..', 'React360');
const librariesRoot = path.resolve(__dirname, '..', 'Libraries');
const libAssetsRoot = path.resolve(__dirname, '..', 'lib-assets');
const nodeModules = path.resolve(__dirname, 'node_modules');

// Packages that code outside this folder imports, which Metro would
// otherwise look for in node_modules folders above ../React360 and
// ../Libraries.
const sharedPackages = [
  '@babel/runtime',
  'create-react-class',
  'eventemitter3',
  'fbjs',
  'invariant',
  'prop-types',
  'react',
  'react-devtools-core',
  'three',
  'three-gltf2-loader',
];

const extraNodeModules = {'react-360-web': runtimeRoot};
for (const name of sharedPackages) {
  extraNodeModules[name] = path.join(nodeModules, name);
}

module.exports = {
  watchFolders: [runtimeRoot, librariesRoot, libAssetsRoot],

  resolver: {
    extraNodeModules,
    assetExts: [...assetExts, 'obj', 'mtl'],
    platforms: ['ios', 'android', 'native', 'vr'],
    providesModuleNodeModules: ['react-native'],
    hasteImplModulePath: path.join(__dirname, 'scripts', 'hasteImpl.js'),

    // metro's createBlacklist builds an invalid RegExp on Windows with
    // current Node versions (it swaps '/' for '\' inside character classes),
    // so the default list is spelled out with separator-agnostic patterns.
    blacklistRE: /(node_modules[\\/]react[\\/]dist[\\/].*|website[\\/]node_modules[\\/].*|heapCapture[\\/]bundle\.js|.*[\\/]__(tests|fixtures)__[\\/].*)$/,
  },
};
