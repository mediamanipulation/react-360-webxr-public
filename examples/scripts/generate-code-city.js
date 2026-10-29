/**
 * Writes code-city/data.json: every JavaScript source file of React 360's
 * runtime (React360/js) and components (Libraries) that git tracks, with its
 * folder and line count. Run with `npm run generate:code-city`.
 */

'use strict';

const {execFileSync} = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const output = path.resolve(__dirname, '..', 'code-city', 'data.json');

const paths = execFileSync('git', ['ls-files', '--', 'React360/js', 'Libraries'], {
  cwd: repoRoot,
  encoding: 'utf8',
})
  .split('\n')
  .filter(file => file.endsWith('.js') && !file.split('/').includes('__tests__'))
  .sort();

const files = paths.map(file => {
  const text = fs.readFileSync(path.join(repoRoot, file), 'utf8');
  const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  return {path: file, folder: path.posix.dirname(file), lines};
});

// One file per line keeps diffs readable when the data is regenerated
fs.writeFileSync(
  output,
  '{\n' +
    '  "source": "git ls-files React360/js Libraries",\n' +
    '  "files": [\n' +
    files.map(file => '    ' + JSON.stringify(file)).join(',\n') +
    '\n  ]\n}\n',
);
console.log(`generate-code-city: wrote ${files.length} files to ${path.relative(repoRoot, output)}`);
