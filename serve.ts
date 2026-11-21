// Isla Fortuna — serve.ts
// Tiny static server for game/ on port 8080 by default (accept --port to override).
// Node 22, stdlib only. Refuses paths outside game/ (403), 404s missing
// files, sends a no-store cache header.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = dirname(fileURLToPath(import.meta.url));
const gameDir = resolve(join(repoDir, 'game'));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

let port = 8080;
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--port' && process.argv[i + 1]) port = parseInt(process.argv[i + 1], 10);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = resolve(join(gameDir, '.' + pathname));
    if (!file.startsWith(gameDir + '/') && file !== gameDir) {
      res.writeHead(403, { 'content-type': 'text/plain' });
      res.end('403 Forbidden');
      return;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
      'content-length': data.length,
    });
    res.end(data);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('500 Internal Server Error');
  }
});

server.listen(port, () => {
  console.log(`Isla Fortuna serving game/ at http://localhost:${port}`);
});
