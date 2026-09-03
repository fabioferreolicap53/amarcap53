// Import CSV → amarcap53_pacientes
// POST /api/custom/import-pacientes
// Body: { csvText, fileName, mode }
// Apenas cap/admin. ES5 puro (Goja engine).

var COLLECTION = 'amarcap53_pacientes';
var LOG_COLLECTION = 'amarcap53_importacoes';
var BATCH_SIZE = 500;
var DATE_FIELDS = ['data_nascimento', 'cito_lab', 'cito_pep', 'dna_hpv_gal', 'dna_hpv_pep'];

// Helper: obtém DB inline (evita problemas de scope no Goja)
// Substituir getDb() por $app.db() diretamente

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
    'unidade_solicitante': ['UNIDADE SOLICITANTE', 'UNIDADE_SOLICITANTE', 'SOLICITANTE', 'UNID SOLICITANTE'],
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

function escSql(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  var s = String(v).replace(/'/g, "''");
  return "'" + s + "'";
}

function doInsert(rows, mappedFields) {
  var db = $app.db();
  if (!db) throw new Error('DB indisponivel');
  var newCount = 0;
  var totalErrors = 0;
  var errorDetails = [];
  var fields = mappedFields.join(', ');
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    try {
      var vals = [];
      for (var fi = 0; fi < mappedFields.length; fi++) {
        var val = sanitizeValue(mappedFields[fi], r[mappedFields[fi]]);
        if (val === null || val === undefined || val === '') { vals.push('NULL'); continue; }
        var fname = mappedFields[fi];
        if (fname === 'microarea' || fname === 'idade') { vals.push(parseInt(val, 10) || 0); }
        else { vals.push(escSql(val)); }
      }
      db.newQuery('INSERT INTO ' + COLLECTION + ' (' + fields + ') VALUES (' + vals.join(', ') + ')').execute();
      newCount++;
    } catch (e) {
      totalErrors++;
      var errMsg = (e && e.message) ? e.message : 'Erro';
      errorDetails.push('#' + (i + 1) + ' ' + (r.cns || r.nome || '?') + ': ' + errMsg);
    }
  }
  if (newCount === 0 && rows.length > 0) throw new Error('Nenhum registro inserido');
  return { newCount: newCount, totalErrors: totalErrors, errorDetails: errorDetails };
}

// ─── Handler legado ─────────────────────────────────────
function handleLegacyBody(c, body, auth) {
  var records = body.records;
  var fileName = body.fileName || 'import.csv';
  var mode = body.mode === 'append' ? 'append' : 'replace';
  if (records.length > 30000) return c.json(413, { code: 413, message: 'Max 30000 registros por lote' });
  var db = $app.db();
  if (!db) return c.json(500, { code: 500, message: 'DB indisponivel' });
  var oldCount = 0;
  var newCount = 0;
  var errors = [];
  var oldIdCnsMap = {};
  try {
    if (mode === 'replace') {
      try { var row = db.newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one(); oldCount = (row && row.get) ? (row.get('total') || 0) : 0; } catch (_) { oldCount = 0; }
      try {
        var oldRows = db.newQuery('SELECT id, cns FROM ' + COLLECTION).all();
        for (var oi = 0; oi < oldRows.length; oi++) {
          var oId = oldRows[oi].get('id');
          var oCns = oldRows[oi].get('cns');
          if (oId && oCns) oldIdCnsMap[oId] = oCns;
        }
      } catch (_) {}
      db.newQuery('DELETE FROM ' + COLLECTION).execute();
    }
    var LEG_FIELDS = ['unidade','equipe','microarea','cns','nome','data_nascimento','idade','grupo','cito_lab','cito_pep','dna_hpv_gal','unidade_solicitante','alertas_rastreamento'];
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      try {
        var fnames = [];
        var fvals = [];
        for (var fi = 0; fi < LEG_FIELDS.length; fi++) {
          var f = LEG_FIELDS[fi];
          var v = null;
          if (f === 'unidade' && r.unidade) v = String(r.unidade).trim();
          else if (f === 'equipe' && r.equipe) v = String(r.equipe).trim();
          else if (f === 'microarea' && r.microarea !== undefined && r.microarea !== null && r.microarea !== '') v = parseInt(r.microarea, 10) || 0;
          else if (f === 'cns' && r.cns) v = padLeft(String(r.cns).replace(/\D/g, ''), 15, '0').slice(-15);
          else if (f === 'nome' && r.nome) v = String(r.nome).trim();
          else if (f === 'data_nascimento' && r.data_nascimento) v = r.data_nascimento;
          else if (f === 'idade' && r.idade !== undefined && r.idade !== null && r.idade !== '') v = parseInt(r.idade, 10) || 0;
          else if (f === 'grupo' && r.grupo !== undefined && r.grupo !== null) v = String(r.grupo).trim();
          else if (f === 'cito_lab' && r.cito_lab) v = r.cito_lab;
          else if (f === 'cito_pep' && r.cito_pep) v = r.cito_pep;
          else if (f === 'dna_hpv_gal' && r.dna_hpv_gal) v = r.dna_hpv_gal;
          else if (f === 'unidade_solicitante' && r.unidade_solicitante) v = String(r.unidade_solicitante).trim();
          else if (f === 'alertas_rastreamento' && r.alertas_rastreamento) v = r.alertas_rastreamento;
          if (v !== null && v !== undefined && v !== '') {
            fnames.push(f);
            if (f === 'microarea' || f === 'idade') fvals.push(parseInt(v, 10) || 0);
            else fvals.push(escSql(v));
          }
        }
        if (fnames.length === 0) continue;
        db.newQuery('INSERT INTO ' + COLLECTION + ' (' + fnames.join(', ') + ') VALUES (' + fvals.join(', ') + ')').execute();
        newCount++;
      } catch (e) {
        errors.push('#' + (i + 1) + ' CNS=' + (r.cns || '?') + ': ' + ((e && e.message) || 'Erro'));
      }
    }
    if (newCount === 0 && records.length > 0) throw new Error('Nenhum registro inserido');
  } catch (e) {
    return c.json(500, { code: 500, message: (e && e.message) || 'Erro', oldCount: oldCount, rollback: true });
  }
  // Re-vincular acompanhamentos huérfãos por CNS (modo replace)
  var relinkResult = { relinked: 0, failed: 0 };
  if (mode === 'replace' && newCount > 0) {
    try {
      var oldIds = [];
      for (var rKey in oldIdCnsMap) { oldIds.push(rKey); }
      if (oldIds.length > 0) {
        var ACOMP = 'amarcap53_acompanhamentos';
        var relinked = 0, relFailed = 0;
        for (var ri = 0; ri < oldIds.length; ri++) {
          var oldPacId = oldIds[ri];
          var pacCns = oldIdCnsMap[oldPacId];
          if (!pacCns) continue;
          var orphRows = db.newQuery('SELECT id, paciente FROM ' + ACOMP + ' WHERE paciente = "' + oldPacId + '"').all();
          if (orphRows.length === 0) continue;
          var newPacRows = db.newQuery('SELECT id FROM ' + COLLECTION + ' WHERE cns = "' + pacCns + '" LIMIT 1').all();
          if (newPacRows.length === 0) { relFailed += orphRows.length; continue; }
          var newPacId = newPacRows[0].get('id');
          for (var ri2 = 0; ri2 < orphRows.length; ri2++) {
            if (newPacId === oldPacId) continue;
            db.newQuery('UPDATE ' + ACOMP + ' SET paciente = "' + newPacId + '" WHERE id = "' + orphRows[ri2].get('id') + '"').execute();
            relinked++;
          }
        }
        relinkResult = { relinked: relinked, failed: relFailed };
      }
    } catch (_) {}
  }
  // Log
  try {
    db.newQuery('INSERT INTO ' + LOG_COLLECTION + ' (filename, total_records, success_count, error_count, user_id, details) VALUES (' +
      escSql(fileName) + ', ' + records.length + ', ' + newCount + ', ' + (records.length - newCount) + ', ' +
      escSql(auth.getId()) + ', ' + escSql(errors.slice(0, 100).join('\n')) + ')').execute();
  } catch (_) {}
  return c.json(200, { success: true, mode: mode, total: records.length, imported: newCount, errors: records.length - newCount, oldCount: oldCount, relink: relinkResult, errorDetails: errors.slice(0, 10) });
}

// ─── Router: POST /api/custom/import-pacientes ──────────
routerAdd('POST', '/api/custom/import-pacientes', function(c) {
  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { code: 401, message: 'Nao autenticado' });
    var role = auth.get('role');
    if (role !== 'cap' && role !== 'admin') return c.json(403, { code: 403, message: 'Apenas CAP ou admin' });
    var body = {};
    try { body = c.parseBody() || {}; } catch(_) {}
    if (!body.csvText && !body.records) {
      try {
        var info = c.requestInfo();
        if (info && info.body && typeof info.body === 'object') {
          var ib = info.body;
          if (typeof ib.get === 'function') {
            body = { csvText: ib.get('csvText'), fileName: ib.get('fileName'), records: ib.get('records'), mode: ib.get('mode') };
          } else {
            body = { csvText: ib.csvText, fileName: ib.fileName, records: ib.records, mode: ib.mode };
          }
        }
      } catch(_) {}
    }
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
    var db = $app.db();
    if (!db) return c.json(500, { code: 500, message: 'DB indisponivel' });
    var oldCount = 0;
    var oldIdCnsMap = {};
    if (mode === 'replace') {
      try { var cntRow = db.newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one(); oldCount = (cntRow && cntRow.get) ? (cntRow.get('total') || 0) : 0; } catch (_) { oldCount = 0; }
      if (oldCount > 0) {
        var oldRows = db.newQuery('SELECT id, cns FROM ' + COLLECTION).all();
        for (var oi = 0; oi < oldRows.length; oi++) {
          var oldId = oldRows[oi].get('id');
          var oldCns = oldRows[oi].get('cns');
          if (oldId && oldCns) oldIdCnsMap[oldId] = oldCns;
        }
        var delIter = 0;
        while (delIter < 500) {
          var chk = db.newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one();
          var rem = (chk && chk.get) ? (chk.get('total') || 0) : 0;
          if (rem === 0) break;
          db.newQuery('DELETE FROM ' + COLLECTION + ' WHERE id IN (SELECT id FROM ' + COLLECTION + ' LIMIT 10000)').execute();
          delIter++;
        }
        var finalRow = db.newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one();
        var leftover = (finalRow && finalRow.get) ? (finalRow.get('total') || 0) : 0;
        if (leftover > 0) return c.json(500, { code: 500, message: leftover + ' registros nao removidos' });
      }
    }
    var insertResult = { newCount: 0, totalErrors: 0, errorDetails: [] };
    if (rows.length > 0) {
      try {
        insertResult = doInsert(rows, mappedFields);
      } catch (e) {
        return c.json(500, { code: 500, message: 'DELETE ok mas INSERT falhou: ' + ((e && e.message) || '?'), oldCount: oldCount, imported: 0, errors: rows.length });
      }
    }
    // Re-vincular acompanhamentos huérfãos por CNS (modo replace)
    var relinkResult = { relinked: 0, failed: 0 };
    if (mode === 'replace' && insertResult.newCount > 0) {
      try {
        var oldIds = [];
        for (var rKey in oldIdCnsMap) { oldIds.push(rKey); }
        if (oldIds.length > 0) {
          var ACOMP = 'amarcap53_acompanhamentos';
          var PAC = COLLECTION;
          var relinked = 0, relFailed = 0;
          for (var ri = 0; ri < oldIds.length; ri++) {
            var oldPacId = oldIds[ri];
            var pacCns = oldIdCnsMap[oldPacId];
            if (!pacCns) continue;
            var orphRows = db.newQuery('SELECT id, paciente FROM ' + ACOMP + ' WHERE paciente = "' + oldPacId + '"').all();
            if (orphRows.length === 0) continue;
            var newPacRows = db.newQuery('SELECT id FROM ' + PAC + ' WHERE cns = "' + pacCns + '" LIMIT 1').all();
            if (newPacRows.length === 0) { relFailed += orphRows.length; continue; }
            var newPacId = newPacRows[0].get('id');
            for (var ri2 = 0; ri2 < orphRows.length; ri2++) {
              if (newPacId === oldPacId) { continue; }
              db.newQuery('UPDATE ' + ACOMP + ' SET paciente = "' + newPacId + '" WHERE id = "' + orphRows[ri2].get('id') + '"').execute();
              relinked++;
            }
          }
          relinkResult = { relinked: relinked, failed: relFailed };
        }
      } catch (relErr) { relinkResult = { relinked: 0, failed: 0, error: (relErr && relErr.message) || 'Erro' }; }
    }
    try {
      db.newQuery('INSERT INTO ' + LOG_COLLECTION + ' (filename, total_records, success_count, error_count, user_id, details) VALUES (' +
        escSql(fileName) + ', ' + rows.length + ', ' + insertResult.newCount + ', ' + insertResult.totalErrors + ', ' +
        escSql(auth.getId()) + ', ' + escSql(insertResult.errorDetails.slice(0, 100).join('\n')) + ')').execute();
    } catch (_) {}
    return c.json(200, { success: true, mode: mode, total: rows.length, imported: insertResult.newCount, errors: insertResult.totalErrors, oldCount: oldCount, relink: relinkResult, mappedFields: mappedFields, errorDetails: insertResult.errorDetails.slice(0, 10) });
  } catch (err) {
    var msg = (err && err.message) ? err.message : 'Erro inesperado';
    console.error('import-pacientes CRASH:', msg);
    return c.json(500, { code: 500, message: msg });
  }
});

// ─── DELETE em massa ────────────────────────────────────
routerAdd('POST', '/api/custom/delete-all', function(c) {
  try {
    var db = $app.db();
    if (!db) return c.json(500, { code: 500, message: 'DB indisponivel' });
    var auth = c.auth;
    if (!auth) return c.json(401, { code: 401, message: 'Nao autenticado' });
    var role = auth.get('role');
    if (role !== 'cap' && role !== 'admin') return c.json(403, { code: 403, message: 'Apenas CAP ou admin' });
    var body = {};
    try { body = c.parseBody() || {}; } catch(_) {}
    if (!body.collection) {
      try {
        var info = c.requestInfo();
        if (info && info.body && typeof info.body === 'object') {
          var ib = info.body;
          if (typeof ib.get === 'function') { body = { collection: ib.get('collection') }; }
          else { body = { collection: ib.collection }; }
        }
      } catch(_) {}
    }
    var collName = body.collection;
    if (!collName || typeof collName !== 'string') return c.json(400, { code: 400, message: 'Envie collection' });
    var row = db.newQuery('SELECT COUNT(*) as total FROM ' + collName).one();
    var before = (row && row.get) ? (row.get('total') || 0) : 0;
    db.newQuery('DELETE FROM ' + collName).execute();
    return c.json(200, { success: true, deleted: before });
  } catch (err) {
    console.error('delete-all ERROR:', (err && err.message) || err);
    return c.json(500, { code: 500, message: (err && err.message) || 'Erro' });
  }
});

// ─── Re-vincular acompanhamentos por CNS ─────────────────
// POST /api/custom/relink-acompanhamentos
// Body: { oldIds: ["id1","id2",...], cnsMap: {"id1":"000...","id2":"001..."} }
// Re-vincula acompanhamentos huérfãos: busca paciente novo pelo CNS, atualiza campo "paciente"
routerAdd('POST', '/api/custom/relink-acompanhamentos', function(c) {
  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { code: 401, message: 'Nao autenticado' });
    var role = auth.get('role');
    if (role !== 'cap' && role !== 'admin') return c.json(403, { code: 403, message: 'Apenas CAP ou admin' });
    var body = {};
    try { body = c.parseBody() || {}; } catch(_) {}
    if (!body.oldIds) {
      try {
        var info = c.requestInfo();
        if (info && info.body && typeof info.body === 'object') {
          var ib = info.body;
          if (typeof ib.get === 'function') {
            body = { oldIds: ib.get('oldIds'), cnsMap: ib.get('cnsMap') };
          } else {
            body = { oldIds: ib.oldIds, cnsMap: ib.cnsMap };
          }
        }
      } catch(_) {}
    }
    var db = $app.db();
    if (!db) return c.json(500, { code: 500, message: 'DB indisponivel' });
    var ACOMP = 'amarcap53_acompanhamentos';
    var PAC = 'amarcap53_pacientes';
    var relinked = 0;
    var already = 0;
    var failed = 0;
    // Coletar IDs antigos de pacientes deletados
    var oldIds = body.oldIds || [];
    var cnsMap = body.cnsMap || {};
    if (oldIds.length === 0) {
      return c.json(200, { success: true, relinked: 0, already: 0, failed: 0, message: 'Nenhum oldId fornecido' });
    }
    // Para cada ID antigo, buscar acompanhamentos que referenciam esse ID
    var orphans = [];
    for (var k = 0; k < oldIds.length; k++) {
      var orphRows = db.newQuery('SELECT id, paciente FROM ' + ACOMP + ' WHERE paciente = "' + oldIds[k] + '"').all();
      for (var oi = 0; oi < orphRows.length; oi++) {
        orphans.push({ id: orphRows[oi].get('id'), oldPacienteId: orphRows[oi].get('paciente') });
      }
    }
    if (orphans.length === 0) {
      return c.json(200, { success: true, relinked: 0, already: 0, failed: 0, message: 'Nenhum acompanhamento huérfão' });
    }
    // Re-vincular: para cada huérfão, buscar paciente novo pelo CNS
    for (var bi = 0; bi < orphans.length; bi++) {
      var orph = orphans[bi];
      var pacienteCns = cnsMap[orph.oldPacienteId];
      if (!pacienteCns) { failed++; continue; }
      var newPacRows = db.newQuery('SELECT id FROM ' + PAC + ' WHERE cns = "' + pacienteCns + '" LIMIT 1').all();
      if (newPacRows.length === 0) { failed++; continue; }
      var newPacienteId = newPacRows[0].get('id');
      if (newPacienteId === orph.oldPacienteId) { already++; continue; }
      db.newQuery('UPDATE ' + ACOMP + ' SET paciente = "' + newPacienteId + '" WHERE id = "' + orph.id + '"').execute();
      relinked++;
    }
    return c.json(200, { success: true, relinked: relinked, already: already, failed: failed, total: orphans.length });
  } catch (err) {
    var msg = (err && err.message) ? err.message : 'Erro inesperado';
    console.error('relink-acompanhamentos CRASH:', msg);
    return c.json(500, { code: 500, message: msg });
  }
});

// ─── Hook auto-delete removido (exclusão explícita via card "Excluir Base")
