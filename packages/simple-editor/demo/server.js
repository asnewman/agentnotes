import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const demoDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.dirname(demoDir);
const PORT = 3000;

const server = http.createServer((req, res) => {
  // Serve from package root, default to demo/index.html
  let requestPath = req.url === '/' ? '/demo/index.html' : req.url;
  let filePath = path.join(packageRoot, requestPath);

  // Security: prevent directory traversal outside package root
  if (!filePath.startsWith(packageRoot)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.css': 'text/css',
    }[ext] || 'text/plain';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Demo server running at http://localhost:${PORT}`);
});
