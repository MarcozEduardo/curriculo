/**
 * Servidor Estatico Local - Curriculo Interativo
 * Puro Node.js (sem dependencias externas).
 * Serve os arquivos do curriculo via HTTP pra que fetch() funcione.
 * + Rota POST /save-questions (painel RAG Config)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3333;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/* ---------- helpers do painel RAG ---------- */

function normalizarTokens(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      chunks.push(c);
      size += c.length;
      if (size > 8_000_000) { reject(new Error('body muito grande')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')); }
      catch (e) { reject(new Error('JSON invalido: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(obj));
}

/* ---------- server ---------- */

const server = http.createServer(async (req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // POST /save-questions
  if (req.method === 'POST' && urlPath === '/save-questions') {
    try {
      const body = await readBody(req);
      const orbit = String(body.orbit || '').trim();
      const facet = String(body.facet || 'default').trim() || 'default';
      const perguntas = Array.isArray(body.perguntas) ? body.perguntas : [];

      if (!orbit || !/^[a-z_]+$/i.test(orbit)) {
        return sendJson(res, 400, { ok: false, error: 'orbita invalida' });
      }
      if (!perguntas.length) {
        return sendJson(res, 400, { ok: false, error: 'nenhuma pergunta recebida' });
      }

      const arquivo = path.join(ROOT, 'chat-rag/rag/mesh/questions', orbit + '.json');
      if (!arquivo.startsWith(ROOT)) {
        return sendJson(res, 403, { ok: false, error: 'fora do escopo' });
      }
      if (!fs.existsSync(arquivo)) {
        return sendJson(res, 404, { ok: false, error: 'orbita nao existe: ' + orbit });
      }

      const dados = JSON.parse(fs.readFileSync(arquivo, 'utf-8'));
      const entries = Array.isArray(dados.entries) ? dados.entries : [];

      // indice de duplicatas (tokens exatos)
      const existentes = new Set();
      for (const e of entries) {
        if (Array.isArray(e)) existentes.add(String(e[2] || '').trim());
      }

      let adicionadas = 0;
      let ignoradas = 0;
      for (const p of perguntas) {
        const tokens = normalizarTokens(p);
        if (!tokens) { ignoradas++; continue; }
        if (existentes.has(tokens)) { ignoradas++; continue; }
        entries.push([facet, '', tokens]);
        existentes.add(tokens);
        adicionadas++;
      }

      dados.entries = entries;
      dados.total = entries.length;
      fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2), 'utf-8');

      console.log('[SAVE-QUESTIONS] ' + orbit + '/' + facet + ' +' + adicionadas + ' ignoradas=' + ignoradas + ' (total ' + dados.total + ')');
      return sendJson(res, 200, { ok: true, adicionadas, ignoradas, total: dados.total });
    } catch (e) {
      console.error('[SAVE-QUESTIONS ERRO]', e.message);
      return sendJson(res, 500, { ok: false, error: e.message });
    }
  }

  // GET estatico (comportamento original)
  let target = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(ROOT, target);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log(' =====================================');
  console.log(' Curriculo rodando em:');
  console.log(' http://localhost:' + PORT);
  console.log(' Painel RAG: http://localhost:' + PORT + '/rag-config.html');
  console.log(' =====================================');
  console.log(' Pra parar: Ctrl+C');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('');
    console.error(' [ERRO] Porta ' + PORT + ' ja esta em uso.');
    console.error(' Feche o outro servidor ou mude PORT no server.js');
    console.error('');
  } else {
    console.error(err);
  }
  process.exit(1);
});
