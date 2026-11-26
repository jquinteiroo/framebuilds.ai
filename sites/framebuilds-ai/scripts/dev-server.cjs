'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createGateway } = require('../netlify/lib/payment-gateway.cjs');
const root = path.resolve(__dirname, '../dist');
const port = Number(process.env.PORT || 3000);
const env = { ...process.env, APP_URL: `http://localhost:${port}` };
const app = createGateway({ env });
const functions = { checkout: app.checkout, 'payment-config': app.config, 'payment-status': app.status, 'mercadopago-webhook': app.webhook };
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, env.APP_URL);
    if (url.pathname.startsWith('/.netlify/functions/')) {
      const handler = functions[url.pathname.slice('/.netlify/functions/'.length)];
      if (!handler) { res.writeHead(404).end(); return; }
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 8192) { res.writeHead(413).end(); return; } chunks.push(chunk); }
      const result = await handler({ httpMethod: req.method, headers: req.headers, body: Buffer.concat(chunks).toString('utf8'), queryStringParameters: Object.fromEntries(url.searchParams) });
      res.writeHead(result.statusCode, result.headers).end(result.body); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(root, '.' + relative);
    if (!file.startsWith(root + path.sep) || relative.split('/').some(part => part.startsWith('.'))) { res.writeHead(404).end(); return; }
    const content = await fs.readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404).end(); }
}).listen(port, '127.0.0.1', () => console.log(`Teste local: http://localhost:${port}/?checkout=test#pacote`));
