/**
 * Builds every demo for production into build/, which can then be served as
 * static files: build/index.html is the landing page and build/<demo>/ holds
 * each demo's page and its two minified bundles.
 */

'use strict';

const {spawnSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const DEMOS = ['solar-system', 'controller-sandbox', 'sound-visualizer', 'code-city'];

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'build');
const cli = path.join(root, 'node_modules', 'react-native', 'local-cli', 'cli.js');

function bundle(demo, entry) {
  const result = spawnSync(
    process.execPath,
    [
      cli,
      'bundle',
      '--entry-file',
      `${demo}/${entry}.js`,
      '--platform',
      'vr',
      '--dev',
      'false',
      '--bundle-output',
      path.join(build, demo, `${entry}.bundle.js`),
      '--assets-dest',
      path.join(build, demo),
    ],
    {cwd: root, stdio: 'inherit'},
  );
  if (result.status !== 0) {
    console.error(`bundle: building ${demo}/${entry}.js failed`);
    process.exit(result.status || 1);
  }
}

function copy(from, to) {
  const target = path.join(build, to);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(path.join(root, from), target);
}

// Points a demo page at its built bundles instead of the development server
function rewritePage(demo) {
  const page = fs.readFileSync(path.join(root, demo, 'index.html'), 'utf8');
  const replacements = [
    ['./client.bundle?platform=vr', './client.bundle.js'],
    ["'index.bundle?platform=vr&dev=true'", "'index.bundle.js'"],
  ];
  const built = replacements.reduce((text, [from, to]) => {
    if (!text.includes(from)) {
      throw new Error(`bundle: ${demo}/index.html no longer loads ${from}`);
    }
    return text.replace(from, to);
  }, page);
  fs.writeFileSync(path.join(build, demo, 'index.html'), built);
}

fs.rmSync(build, {recursive: true, force: true});
for (const demo of DEMOS) {
  fs.mkdirSync(path.join(build, demo), {recursive: true});
  bundle(demo, 'index');
  bundle(demo, 'client');
  rewritePage(demo);
}
copy('index.html', 'index.html');
// ?emulate loads IWER from ../node_modules, relative to each demo page
copy('shared/emulate.js', 'shared/emulate.js');
copy('node_modules/iwer/build/iwer.min.js', 'node_modules/iwer/build/iwer.min.js');

console.log(`bundle: built ${DEMOS.length} demos into ${path.relative(process.cwd(), build) || '.'}`);
