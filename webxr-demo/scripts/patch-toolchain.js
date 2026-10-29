/**
 * Patches the 2019-era Metro 0.51 bundler so it runs on current Node.
 * Runs on postinstall, and is safe to run more than once.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PATCHES = [
  {
    // OpenSSL 3 (Node 17+) dropped md4. This hash only keys Metro's cache,
    // so any stable hash works.
    file: 'node_modules/metro-cache/src/stableHash.js',
    from: 'createHash("md4")',
    to: 'createHash("md5")',
  },
  {
    // The default blacklist swaps every '/' for the path separator, which
    // makes `[/\\]` an unterminated character class on Windows, and the
    // React Native CLI builds it before reading metro.config.js. Escape the
    // separator, as later Metro versions do.
    file: 'node_modules/metro-config/src/defaults/blacklist.js',
    from: 'return pattern.source.replace(/\\//g, path.sep);',
    to: 'return pattern.source.replace(/\\/|\\\\\\//g, "\\\\" + path.sep);',
  },
];

// Since Babel 7.17 path.stop() ends the whole traversal rather than just this
// plugin's visit, so every plugin after a `Symbol.iterator` member expression
// skips the rest of the file, leaving Flow types in the bundle. Later Metro
// versions skip just the replaced node. npm installs a second copy of the
// preset for the transformer.
for (const dir of [
  'node_modules/metro-react-native-babel-preset',
  'node_modules/metro-react-native-babel-transformer/node_modules/metro-react-native-babel-preset',
]) {
  const file = `${dir}/src/transforms/transform-symbol-member.js`;
  if (fs.existsSync(path.resolve(__dirname, '..', file))) {
    PATCHES.push({file, from: 'path.stop();', to: 'path.skip();'});
  }
}

for (const patch of PATCHES) {
  const file = path.resolve(__dirname, '..', patch.file);
  const contents = fs.readFileSync(file, 'utf8');
  if (contents.includes(patch.to)) {
    continue;
  }
  if (!contents.includes(patch.from)) {
    throw new Error(`patch-toolchain: unexpected contents in ${patch.file}`);
  }
  fs.writeFileSync(file, contents.replace(patch.from, patch.to), 'utf8');
  console.log(`patch-toolchain: patched ${patch.file}`);
}
