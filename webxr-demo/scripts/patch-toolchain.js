/**
 * Patches the 2018-era React Native 0.55 CLI so it runs on current Node.
 * Runs on postinstall, and is safe to run more than once.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PATCHES = [
  {
    // Node refuses to spawn .bat files without a shell since the fix for
    // CVE-2024-27980 (Node 18.20.2 / 20.12.2), and the CLI's setup_env.bat
    // contains only comments, so skip it on Windows.
    file: 'node_modules/react-native/local-cli/cliEntry.js',
    from: '  childProcess.execFileSync(path.join(__dirname, setupEnvScript));',
    to:
      "  if (setupEnvScript !== 'setup_env.bat') {\n" +
      '    childProcess.execFileSync(path.join(__dirname, setupEnvScript));\n' +
      '  }',
  },
  {
    // OpenSSL 3 (Node 17+) dropped md4. This hash only keys Metro's cache,
    // so any stable hash works.
    file: 'node_modules/metro-cache/src/stableHash.js',
    from: "createHash('md4')",
    to: "createHash('md5')",
  },
];

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
