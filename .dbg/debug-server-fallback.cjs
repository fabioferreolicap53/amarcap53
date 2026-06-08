const http = require('http');
const fs = require('fs');
const path = require('path');

const sessionId = 'acompanhamento-save-fail';
const outdir = path.resolve(process.cwd(), '.dbg');
const logFile = path.join(outdir, `trae-debug-log-${sessionId}.ndjson`);
const envFile = path.join(outdir, `${sessionId}.env`);
const port = 7777;

fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(logFile, '');
fs.writeFileSync(envFile, `DEBUG_SERVER_URL=http://127.0.0.1:${port}/event\nDEBUG_SESSION_ID=${sessionId}\n`);

const send = (res, status = 200, body = 'ok', contentType = 'text/plain; charset=utf-8') => {
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': contentType,
  });
  res.end(body);
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, JSON.stringify({ ok: true, sessionId, logFile }), 'application/json; charset=utf-8');
  }

  if (req.method === 'GET' && req.url.startsWith('/logs')) {
    const body = fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
    return send(res, 200, body);
  }

  if (req.method === 'POST' && req.url === '/event') {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(raw || '{}');
        if (!parsed.ts) parsed.ts = Date.now();
        fs.appendFileSync(logFile, JSON.stringify(parsed) + '\n');
        send(res, 200, 'ok');
      } catch (err) {
        send(res, 400, String(err));
      }
    });
    return;
  }

  send(res, 404, 'not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log('@@DEBUG_SERVER_INFO');
  console.log(JSON.stringify({
    api_url: `http://127.0.0.1:${port}/event`,
    session_id: sessionId,
    log_dir: outdir,
    log_file: logFile,
    env_file: envFile,
  }, null, 2));
  console.log('@@END_DEBUG_SERVER_INFO');
});
