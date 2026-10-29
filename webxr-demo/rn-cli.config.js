'use strict';

var path = require('path');

// This demo runs against the WebXR port of the runtime in ../React360 instead
// of the react-360-web package from npm. Metro 0.30 does not follow symlinks,
// so the runtime is added as a project root and resolved through
// extraNodeModules rather than installed as an npm `file:` dependency.
var runtimeRoot = path.resolve(__dirname, '..', 'React360');
var nodeModules = path.resolve(__dirname, 'node_modules');

var config = {
  getProjectRoots() {
    return [path.resolve(__dirname), runtimeRoot];
  },

  extraNodeModules: {
    'react-360-web': runtimeRoot,
    eventemitter3: path.join(nodeModules, 'eventemitter3'),
    three: path.join(nodeModules, 'three'),
    'three-gltf2-loader': path.join(nodeModules, 'three-gltf2-loader'),
  },

  // metro/src/blacklist builds an invalid RegExp on Windows with current Node
  // versions (it swaps '/' for '\' inside character classes), so the default
  // list is spelled out here with separator-agnostic patterns.
  getBlacklistRE() {
    return /(node_modules[\\/]react[\\/]dist[\\/].*|website[\\/]node_modules[\\/].*|heapCapture[\\/]bundle\.js|.*[\\/]__tests__[\\/].*)$/;
  },

  getAssetExts() {
    return ['obj', 'mtl'];
  },

  getPlatforms() {
    return ['vr'];
  },

  getProvidesModuleNodeModules() {
    return ['react-native', 'react-360'];
  },
};

module.exports = config;
