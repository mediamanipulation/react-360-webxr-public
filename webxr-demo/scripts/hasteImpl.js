/**
 * Names the Haste modules for Metro. React Native 0.59 names its own modules
 * by file name, while React 360's components in ../Libraries (and a few files
 * in ../React360 and this app) still declare theirs with `@providesModule`, so
 * this reads that tag for anything React Native's implementation doesn't name.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const reactNativeHaste = require('react-native/jest/hasteImpl');

// Haste names resolve before node_modules, so naming this file makes
// `require('react-360')` load the sources in ../Libraries.
const ENTRY_POINT = path.resolve(__dirname, '..', '..', 'Libraries', 'react-360.js');

module.exports = {
  getHasteName(filePath) {
    const name = reactNativeHaste.getHasteName(filePath);
    if (name !== undefined) {
      return name;
    }
    if (filePath === ENTRY_POINT) {
      return 'react-360';
    }
    if (!filePath.endsWith('.js')) {
      return undefined;
    }
    const match = /@providesModule\s+(\S+)/.exec(fs.readFileSync(filePath, 'utf8'));
    return match ? match[1] : undefined;
  },
};
