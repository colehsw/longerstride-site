// Local preview without Vercel: serves public/ and runs api/subscribe.js.
// With no Klaviyo keys set, Klaviyo calls are faked and printed, so nothing is sent.
const http = require('http');
const fs = require('fs');
const path = require('path');
const handler = require('../api/subscribe.js');

const ROOT = path.join(__dirname, '..', 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const PORT = process.env.PORT || 3000;

if (!process.env.KLAVIYO_PRIVATE_KEY) {
  process.env.KLAVIYO_PRIVATE_KEY = 'preview';
  process.env.KLAVIYO_LIST_ID = process.env.KLAVIYO_LIST_ID || 'PREVIEW_LIST';
  global.fetch = async (url, opts) => {
    console.log('[fake Klaviyo]', url, opts.body.slice(0, 300));
    return { ok: process.env.PREVIEW_FAIL !== '1', status: 202, text: async () => '' };
  };
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/subscribe') {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => {
      const shim = {
        status(c) { res.statusCode = c; return shim; },
        json(j) { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(j)); return shim; },
        setHeader: (k, v) => res.setHeader(k, v),
      };
      handler({ method: req.method, body: raw }, shim);
    });
    return;
  }
  let p = url.pathname === '/' || url.pathname === '/level-check' ? '/index.html' : url.pathname;
  if (!path.extname(p)) p += '.html';
  const file = path.join(ROOT, path.normalize(p));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Preview at http://localhost:${PORT}`));
