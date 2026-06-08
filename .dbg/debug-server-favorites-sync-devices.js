const http = require('http');
const fs = require('fs');
const path = require('path');

const session = 'favorites-sync-devices';
const outdir = path.resolve('.dbg');
const port = 7777;
const host = '127.0.0.1';
const logFile = path.join(outdir, `trae-debug-log-${session}.ndjson`);
const envFile = path.join(outdir, `${session}.env`);
const apiUrl = `http://${host}:${port}/event`;

fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(logFile, '');
fs.writeFileSync(envFile, `DEBUG_SERVER_URL=${apiUrl}\nDEBUG_SESSION_ID=${session}\n`);

let lastActivity = Date.now();

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/event') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      lastActivity = Date.now();
      try {
        const event = JSON.parse(body || '{}');
        if (!event.ts) event.ts = Date.now();
        fs.appendFileSync(logFile, `${JSON.stringify(event)}\n`);
        res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/plain' });
        res.end('ok');
      } catch {
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'text/plain' });
        res.end('bad json');
      }
    });
    return;
  }

  if (req.method === 'GET' && req.url === '/logs') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/x-ndjson' });
    res.end(fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '');
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, session, ts: Date.now() }));
    return;
  }

  res.writeHead(404, corsHeaders);
  res.end('not found');
});

server.listen(port, host, () => {
  console.log('@@DEBUG_SERVER_INFO');
  console.log(JSON.stringify({
    api_url: apiUrl,
    session_id: session,
    log_dir: outdir,
    log_file: logFile,
    env_file: envFile,
  }, null, 2));
  console.log('@@END_DEBUG_SERVER_INFO');
});

setInterval(() => {
  if (Date.now() - lastActivity > 1200000) {
    server.close(() => process.exit(0));
  }
}, 5000);
