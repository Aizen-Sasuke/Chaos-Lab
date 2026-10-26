/**
 * CHAOS LAB — zero-dependency static server
 * `npm run dev` should work on a fresh clone without `npm install`.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(body);
}

function resolveFile(urlPath) {
  // Decode and normalise, then make sure the result is inside this directory.
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = path.normalize(decoded).replace(/^([/\\])+/, '');
  const absolute = path.resolve(__dirname, relative);

  if (absolute !== __dirname && !absolute.startsWith(__dirname + path.sep)) {
    return null;
  }
  return absolute;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
    return;
  }

  let filePath = resolveFile(req.url || '/');
  if (!filePath) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    // Directories (and any unknown path) fall back to index.html so deep
    // links keep working, matching the old express behaviour.
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    } else if (err) {
      filePath = path.join(__dirname, 'index.html');
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        send(res, 404, 'Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      send(res, 200, req.method === 'HEAD' ? undefined : data, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream'
      });
    });
  });
});

server.listen(PORT, () => {
  console.log(`CHAOS LAB server running on http://localhost:${PORT}`);
});
