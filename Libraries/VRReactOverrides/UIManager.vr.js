/**
 * React Native 0.59 looks up view configs with UIManager.getViewManagerConfig,
 * which outside development only finds them on iOS or through a synchronous
 * native call. React 360's UIManager sits behind an asynchronous bridge and
 * sends every view config with its module constants, so fall back to those.
 *
 * @providesModule UIManager
 * @flow
 */

'use strict';

const UIManager = require('react-native/Libraries/ReactNative/UIManager');

const getViewManagerConfig = UIManager.getViewManagerConfig;
UIManager.getViewManagerConfig = function(viewManagerName: string) {
  return getViewManagerConfig(viewManagerName) || UIManager[viewManagerName];
};

module.exports = UIManager;
