// Import CSV → amarcap53_pacientes
// POST /api/custom/import-pacientes
// Body: { csvText, fileName, mode }
// Apenas cap/admin. ES5 puro (Goja engine).

var COLLECTION = 'amarcap53_pacientes';
var LOG_COLLECTION = 'amarcap53_importacoes';
var BATCH_SIZE = 500;
var DATE_FIELDS = ['data_nascimento', 'cito_lab', 'cito_pep', 'dna_hpv_gal', 'dna_hpv_pep'];

// Helper: obtém DAO (funciona em v0.24+ e v0.25+)
function getDao() {
  try { return $app.dao(); } catch(e) { return null; }
}

function padLeft(str, len, ch) {
  var s = String(str);
  ch = ch || ' ';
  while (s.length < len) s = ch + s;
  return s;
}

function isDateField(f) {
  for (var i = 0; i < DATE_FIELDS.length; i++) {
    if (DATE_FIELDS[i] === f) return true;
  }
  return false;
}

function normalizeHeader(h) {
  return h.trim().toUpperCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function findField(csvHeader) {
  var n = normalizeHeader(csvHeader);
  var ALIASES = {
    'unidade': ['UNIDADE', 'UNIDADE DE SAUDE', 'ESTABELECIMENTO', 'UBS'],
    'equipe': ['EQUIPE', 'EQUIPE DE SAUDE', 'EQ'],
    'microarea': ['MICROAREA', 'MICRO AREA', 'MICRO', 'MICROAREA'],
    'cns': ['CNS', 'CARTAO SUS', 'NUMERO CNS'],
    'nome': ['NOME', 'NOME PACIENTE', 'NOME DO PACIENTE', 'PACIENTE', 'NOME COMPLETO'],
    'data_nascimento': ['NASC', 'DATA DE NASCIMENTO', 'DATA NASCIMENTO', 'NASCIMENTO', 'DATA_NASCIMENTO'],
    'idade': ['IDADE', 'ANOS'],
    'grupo': ['GRUPO', 'FAIXA ETARIA', 'CATEGORIA'],
    'cito_lab': ['CITO LAB', 'CITO LABORATORIO', 'CITO_LAB', 'CITOLAB'],
    'cito_pep': ['CITO PEP', 'CITO_PEP', 'CITOPEP'],
    'dna_hpv_gal': ['DNA-HPV', 'DNA_HPV_GAL', 'DNA HPV', 'DNA HPV GAL'],
    'alertas_rastreamento': ['ALERTAS RASTREAMENTO', 'ALERTAS', 'OBSERVACOES']
  };
  var key, aliases, i;
  for (key in ALIASES) {
    aliases = ALIASES[key];
    for (i = 0; i < aliases.length; i++) {
      if (normalizeHeader(aliases[i]) === n) return key;
    }
  }
  for (key in ALIASES) {
    aliases = ALIASES[key];
    for (i = 0; i < aliases.length; i++) {
      var na = normalizeHeader(aliases[i]);
      if (n.indexOf(na) !== -1 || na.indexOf(n) !== -1) return key;
    }
  }
  return null;
}

function parseCSVLine(line) {
  var fields = [];
  var cur = '';
  var inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  fields.push(cur.trim());
  return fields;
}

function parseCSV(text) {
  var raw = text.replace(/^\ufeff/, '').replace(/\r/g, '').split('\n');
  var lines = [];
  for (var i = 0; i < raw.length; i++) {
    if (raw[i].trim()) lines.push(raw[i]);
  }
  if (lines.length < 2) return { headers: [], rows: [] };
  var rawHeaders = parseCSVLine(lines[0]);
  var headers = [];
  for (var h = 0; h < rawHeaders.length; h++) {
    headers.push(findField(rawHeaders[h]));
  }
  var rows = [];
  for (var r = 1; r < lines.length; r++) {
    var vals = parseCSVLine(lines[r]);
    var row = {};
    var hasData = false;
    for (var j = 0; j < headers.length && j < vals.length; j++) {
      if (!headers[j]) continue;
      row[headers[j]] = vals[j] || '';
      if (vals[j] && vals[j].trim()) hasData = true;
    }
    if (hasData) rows.push(row);
  }
  return { headers: headers, rows: rows };
}

function parseDate(str) {
  if (!str || str === '--' || str.trim() === '') return null;
  var s = str.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  var parts = s.split('/');
  if (parts.length === 3) {
    var d = parts[0];
    var m = parts[1];
    var y = parts[2];
    if (y.length === 2) y = '20' + y;
    return y + '-' + padLeft(m, 2, '0') + '-' + padLeft(d, 2, '0');
  }
  return null;
}

function sanitizeValue(field, val) {
  if (val === undefined || val === null) return null;
  var s = String(val).trim();
  if (s === '' || s === '--') return null;
  if (isDateField(field)) return parseDate(s);
  if (field === 'microarea' || field === 'idade') return parseInt(s, 10) || 0;
  if (field === 'cns') return padLeft(s.replace(/\D/g, ''), 15, '0').slice(-15);
  return s;
}

function doInsert(dao, collection, rows, mappedFields) {
  var newCount = 0;
  var totalErrors = 0;
  var errorDetails = [];
  dao.runInTransaction(function(txDao) {
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      try {
        var rec = txDao.createRecord(collection);
        for (var fi = 0; fi < mappedFields.length; fi++) {
          var val = sanitizeValue(mappedFields[fi], r[mappedFields[fi]]);
          if (val !== null) rec.set(mappedFields[fi], val);
        }
        txDao.saveRecord(rec);
        newCount++;
      } catch (e) {
        totalErrors++;
        var errMsg = (e && e.message) ? e.message : 'Erro';
        errorDetails.push('#' + (i + 1) + ' ' + (r.cns || r.nome || '?') + ': ' + errMsg);
      }
    }
    if (newCount === 0 && rows.length > 0) throw new Error('Nenhum registro inserido');
  });
  return { newCount: newCount, totalErrors: totalErrors, errorDetails: errorDetails };
}

// ─── Handler legado ─────────────────────────────────────
function handleLegacyBody(c, body, auth) {
  var records = body.records;
  var fileName = body.fileName || 'import.csv';
  var mode = body.mode === 'append' ? 'append' : 'replace';
  if (records.length > 30000) return c.json(413, { code: 413, message: 'Max 30000 registros por lote' });
  var dao = getDao();
  if (!dao) return c.json(500, { code: 500, message: 'DAO API indisponivel' });
  var coll = dao.findCollectionByNameOrId(COLLECTION);
  if (!coll) return c.json(500, { code: 500, message: 'Collection nao encontrada' });
  var oldCount = 0;
  var newCount = 0;
  var errors = [];
  try {
    dao.runInTransaction(function(txDao) {
      if (mode === 'replace') {
        try { var row = txDao.db().newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one(); oldCount = (row && row.get) ? (row.get('total') || 0) : 0; } catch (_) { oldCount = 0; }
        txDao.db().newQuery('DELETE FROM ' + COLLECTION).execute();
      }
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        try {
          var rec = txDao.createRecord(coll);
          if (r.unidade) rec.set('unidade', String(r.unidade).trim());
          if (r.equipe) rec.set('equipe', String(r.equipe).trim());
          if (r.microarea !== undefined && r.microarea !== null && r.microarea !== '') rec.set('microarea', parseInt(r.microarea, 10) || 0);
          if (r.cns) rec.set('cns', padLeft(String(r.cns).replace(/\D/g, ''), 15, '0').slice(-15));
          if (r.nome) rec.set('nome', String(r.nome).trim());
          if (r.data_nascimento) rec.set('data_nascimento', r.data_nascimento);
          if (r.idade !== undefined && r.idade !== null && r.idade !== '') rec.set('idade', parseInt(r.idade, 10) || 0);
          if (r.grupo !== undefined && r.grupo !== null) rec.set('grupo', String(r.grupo).trim());
          if (r.cito_lab) rec.set('cito_lab', r.cito_lab);
          if (r.cito_pep) rec.set('cito_pep', r.cito_pep);
          if (r.dna_hpv_gal) rec.set('dna_hpv_gal', r.dna_hpv_gal);
          if (r.alertas_rastreamento) rec.set('alertas_rastreamento', r.alertas_rastreamento);
          txDao.saveRecord(rec);
          newCount++;
        } catch (e) {
          errors.push('#' + (i + 1) + ' CNS=' + (r.cns || '?') + ': ' + ((e && e.message) || 'Erro'));
        }
      }
      if (newCount === 0 && records.length > 0) throw new Error('Nenhum registro inserido');
    });
  } catch (e) {
    return c.json(500, { code: 500, message: (e && e.message) || 'Erro', oldCount: oldCount, rollback: true });
  }
  try { var logColl = dao.findCollectionByNameOrId(LOG_COLLECTION); if (logColl) { var log = dao.createRecord(logColl); log.set('filename', fileName); log.set('total_records', records.length); log.set('success_count', newCount); log.set('error_count', records.length - newCount); log.set('user_id', auth.getId()); if (errors.length > 0) log.set('details', errors.slice(0, 100).join('\n')); dao.saveRecord(log); } } catch (_) {}
  return c.json(200, { success: true, mode: mode, total: records.length, imported: newCount, errors: records.length - newCount, oldCount: oldCount, errorDetails: errors.slice(0, 10) });
}

// ─── Router: POST /api/custom/import-pacientes ──────────
routerAdd('POST', '/api/custom/import-pacientes', function(c) {
  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { code: 401, message: 'Nao autenticado' });
    var role = auth.get('role');
    if (role !== 'cap' && role !== 'admin') return c.json(403, { code: 403, message: 'Apenas CAP ou admin' });
    var body;
    try {
      var info = c.requestInfo();
      if (info && info.body) {
        body = (typeof info.body === 'object') ? info.body : {};
        if (body && typeof body.get === 'function') {
          body = { csvText: body.get('csvText'), fileName: body.get('fileName'), records: body.get('records'), mode: body.get('mode') };
        }
      } else { body = {}; }
    } catch (_) { try { body = c.parseBody() || {}; } catch (_2) { body = {}; } }
    var bodyMode = body.mode || 'replace';
    if (body.records && Array.isArray(body.records)) return handleLegacyBody(c, body, auth);
    var csvText = body.csvText;
    if (!csvText || typeof csvText !== 'string' || csvText.trim().length === 0) return c.json(400, { code: 400, message: 'Envie csvText' });
    var fileName = body.fileName || 'import.csv';
    var mode = (bodyMode === 'append') ? 'append' : 'replace';
    var parsed = parseCSV(csvText);
    var csvHeaders = parsed.headers;
    var rows = parsed.rows;
    if (rows.length === 0) return c.json(400, { code: 400, message: 'CSV vazio' });
    var mappedFields = [];
    for (var mi = 0; mi < csvHeaders.length; mi++) { if (csvHeaders[mi]) mappedFields.push(csvHeaders[mi]); }
    var hasNome = false;
    var hasCns = false;
    for (var vi = 0; vi < mappedFields.length; vi++) {
      if (mappedFields[vi] === 'nome') hasNome = true;
      if (mappedFields[vi] === 'cns') hasCns = true;
    }
    if (!hasNome || !hasCns) return c.json(400, { code: 400, message: 'CSV precisa de "nome" e "cns". Encontradas: ' + mappedFields.join(', ') });
    var dao = getDao();
    if (!dao) return c.json(500, { code: 500, message: 'DAO API indisponivel' });
    var collection = dao.findCollectionByNameOrId(COLLECTION);
    if (!collection) return c.json(500, { code: 500, message: 'Collection nao encontrada' });
    var oldCount = 0;
    if (mode === 'replace') {
      try { var cntRow = dao.db().newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one(); oldCount = (cntRow && cntRow.get) ? (cntRow.get('total') || 0) : 0; } catch (_) { oldCount = 0; }
      if (oldCount > 0) {
        var delIter = 0;
        while (delIter < 500) {
          var chk = dao.db().newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one();
          var rem = (chk && chk.get) ? (chk.get('total') || 0) : 0;
          if (rem === 0) break;
          dao.db().newQuery('DELETE FROM ' + COLLECTION + ' WHERE id IN (SELECT id FROM ' + COLLECTION + ' LIMIT 10000)').execute();
          delIter++;
        }
        var finalRow = dao.db().newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one();
        var leftover = (finalRow && finalRow.get) ? (finalRow.get('total') || 0) : 0;
        if (leftover > 0) return c.json(500, { code: 500, message: leftover + ' registros nao removidos' });
      }
    }
    var insertResult = { newCount: 0, totalErrors: 0, errorDetails: [] };
    if (rows.length > 0) {
      try {
        insertResult = doInsert(dao, collection, rows, mappedFields);
      } catch (e) {
        return c.json(500, { code: 500, message: 'DELETE ok mas INSERT falhou: ' + ((e && e.message) || '?'), oldCount: oldCount, imported: 0, errors: rows.length });
      }
    }
    try { var logColl = dao.findCollectionByNameOrId(LOG_COLLECTION); if (logColl) { var log = dao.createRecord(logColl); log.set('filename', fileName); log.set('total_records', rows.length); log.set('success_count', insertResult.newCount); log.set('error_count', insertResult.totalErrors); log.set('user_id', auth.getId()); if (insertResult.errorDetails.length > 0) log.set('details', insertResult.errorDetails.slice(0, 100).join('\n')); dao.saveRecord(log); } } catch (_) {}
    return c.json(200, { success: true, mode: mode, total: rows.length, imported: insertResult.newCount, errors: insertResult.totalErrors, oldCount: oldCount, mappedFields: mappedFields, errorDetails: insertResult.errorDetails.slice(0, 10) });
  } catch (err) {
    var msg = (err && err.message) ? err.message : 'Erro inesperado';
    console.error('import-pacientes CRASH:', msg);
    return c.json(500, { code: 500, message: msg });
  }
});

// ─── DELETE em massa ────────────────────────────────────
routerAdd('POST', '/api/custom/delete-all', function(c) {
  try {
    var dao = getDao();
    if (!dao) return c.json(500, { code: 500, message: 'DAO API indisponivel' });
    var auth = c.auth;
    if (!auth) return c.json(401, { code: 401, message: 'Nao autenticado' });
    var role = auth.get('role');
    if (role !== 'cap' && role !== 'admin') return c.json(403, { code: 403, message: 'Apenas CAP ou admin' });
    var body;
    try { var info = c.requestInfo(); if (info && info.body) { body = (typeof info.body === 'object') ? info.body : {}; if (body && typeof body.get === 'function') { body = { collection: body.get('collection') }; } } else { body = {}; } } catch (_) { try { body = c.parseBody() || {}; } catch (_2) { body = {}; } }
    var collName = body.collection;
    if (!collName || typeof collName !== 'string') return c.json(400, { code: 400, message: 'Envie collection' });
    var db = dao.db();
    var row = db.newQuery('SELECT COUNT(*) as total FROM ' + collName).one();
    var before = (row && row.get) ? (row.get('total') || 0) : 0;
    db.newQuery('DELETE FROM ' + collName).execute();
    return c.json(200, { success: true, deleted: before });
  } catch (err) {
    console.error('delete-all ERROR:', (err && err.message) || err);
    return c.json(500, { code: 500, message: (err && err.message) || 'Erro' });
  }
});

// ─── Hook: auto-delete no primeiro create ───────────────
var _autoDeleteDone = false;
onRecordCreate(function(e) {
  if (_autoDeleteDone) return e.next();
  _autoDeleteDone = true;
  try {
    var dao = getDao();
    if (!dao) return e.next();
    var db = dao.db();
    var total = 0;
    try { var row = db.newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one(); total = (row && row.get) ? (row.get('total') || 0) : 0; } catch (_) {}
    if (total === 0) return e.next();
    var iter = 0;
    while (iter < 500) {
      var chk = db.newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one();
      var rem = (chk && chk.get) ? (chk.get('total') || 0) : 0;
      if (rem === 0) break;
      db.newQuery('DELETE FROM ' + COLLECTION + ' WHERE id IN (SELECT id FROM ' + COLLECTION + ' LIMIT 10000)').execute();
      iter++;
    }
  } catch (err) {}
  return e.next();
}, COLLECTION);
