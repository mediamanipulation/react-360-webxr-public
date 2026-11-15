'use strict';

// Runs the unit tests of the React 360 runtime in ../React360, which has no
// dependencies of its own installed: Jest, Babel and the packages the runtime
// imports (like three) all come from this app's node_modules.
module.exports = {
  rootDir: '../React360/js',
  testMatch: ['**/__tests__/**/*-test.js'],
  modulePaths: [`${__dirname}/node_modules`],
  transform: {'^.+\\.js$': `${__dirname}/node_modules/babel-jest`},
  testEnvironment: 'jsdom',
  // The runtime's tests are written for automocking: each one names the
  // modules it wants real with jest.dontMock
  automock: true,
  unmockedModulePathPatterns: ['node_modules'],
  globals: {__DEV__: true},
};
