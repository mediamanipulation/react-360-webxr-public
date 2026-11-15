import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = name => path.join(here, 'src', name);

// The demo shows the same photos, video and sounds as ../webxr-demo. They
// are served from there instead of being kept twice.
const ASSETS = path.join(here, '..', 'webxr-demo', 'static_assets');
const TYPES = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
};

function sharedAssets() {
  return {
    name: 'shared-static-assets',
    configureServer(server) {
      server.middlewares.use('/static_assets', (request, response, next) => {
        const name = path.basename(decodeURIComponent(request.url.split('?')[0]));
        const file = path.join(ASSETS, name);
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
          next();
          return;
        }
        const size = fs.statSync(file).size;
        const type = TYPES[path.extname(file)] || 'application/octet-stream';
        // Video needs range requests to play and seek
        const range = /bytes=(\d+)-(\d*)/.exec(request.headers.range || '');
        if (range) {
          const start = Number(range[1]);
          const end = range[2] ? Number(range[2]) : size - 1;
          response.writeHead(206, {
            'Content-Type': type,
            'Content-Range': `bytes ${start}-${end}/${size}`,
            'Content-Length': end - start + 1,
            'Accept-Ranges': 'bytes',
          });
          fs.createReadStream(file, {start, end}).pipe(response);
        } else {
          response.writeHead(200, {
            'Content-Type': type,
            'Content-Length': size,
            'Accept-Ranges': 'bytes',
          });
          fs.createReadStream(file).pipe(response);
        }
      });
    },
    // A production build gets its own copy
    closeBundle() {
      const dist = path.join(here, 'dist');
      if (fs.existsSync(dist)) {
        fs.cpSync(ASSETS, path.join(dist, 'static_assets'), {recursive: true});
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), sharedAssets()],
  resolve: {
    // App code keeps the imports it had on the original React 360
    alias: {
      'react-360-web': src('index.js'),
      'react-360': src('index.js'),
      'react-native': src('react-native.js'),
      VideoModule: src('video-module.js'),
    },
  },
  server: {port: 8083, strictPort: true},
  preview: {port: 8083, strictPort: true},
});
