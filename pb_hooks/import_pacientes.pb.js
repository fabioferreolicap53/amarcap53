// Custom endpoint: Import CSV directly to amarcap53_pacientes
// Uso: POST /api/custom/import-pacientes
// Body (novo): { csvText: "raw csv...", fileName: "exemplo.csv" }
// Body (legado): { records: [...], fileName: "...", mode: "replace"|"append" }
// Apenas cap/admin. Transação all-or-nothing.
// Otimizado para 1GB RAM VM: processa em lotes de 500

const COLLECTION = 'amarcap53_pacientes';
const LOG_COLLECTION = 'amarcap53_importacoes';
const BATCH_SIZE = 500;

// Mapa: nome do campo no PocketBase → aliases do CSV (normalizados)
const FIELD_ALIASES = {
  'unidade':               ['UNIDADE', 'UNIDADE DE SAUDE', 'UNIDADE SAÚDE', 'UNIDADE SAUDE', 'ESTABELECIMENTO', 'UBS'],
  'equipe':                ['EQUIPE', 'EQUIPE DE SAUDE', 'EQUIPE SAÚDE', 'EQUIPE SAUDE', 'EQ'],
  'microarea':             ['MICROAREA', 'MICRO ÁREA', 'MICRO AREA', 'MICRO', 'MICROÁREA', 'MICRO_AREA'],
  'cns':                   ['CNS', 'CARTAO SUS', 'CARTÃO SUS', 'NUMERO CNS', 'Nº CNS', 'N° CNS', 'CNS/CPF'],
  'nome':                  ['NOME', 'NOME PACIENTE', 'NOME DO PACIENTE', 'PACIENTE', 'NOME COMPLETO'],
  'data_nascimento':       ['NASC', 'DATA DE NASCIMENTO', 'DATA NASCIMENTO', 'NASCIMENTO', 'DATA_NASCIMENTO', 'DT NASCIMENTO', 'DT NASC', 'DATA NASC'],
  'idade':                 ['IDADE', 'ANOS'],
  'grupo':                 ['GRUPO', 'FAIXA ETÁRIA', 'FAIXA ETARIA', 'FAIXA ETARIA', 'CATEGORIA'],
  'cito_lab':              ['CITO LAB', 'RESULTADO DE CITO LABORATÓRIO', 'CITO LABORATORIO', 'CITO LABORATÓRIO', 'CITO_LAB', 'CITO LAB', 'CITOLAB'],
  'cito_pep':              ['CITO PEP', 'RESULTADO DE CITO REGISTRADO NO PEP', 'CITO_PEP', 'CITO PEP', 'CITOPEP'],
  'dna_hpv_gal':           ['DNA-HPV', 'TESTE MOLECULAR DNA-HPV', 'DNA_HPV_GAL', 'DNA HPV', 'DNA HPV GAL', 'DNA-HPV GAL'],
  'alertas_rastreamento':  ['ALERTAS RASTREAMENTO', 'ALERTAS', 'ALERTA', 'ALERTAS DE RASTREAMENTO', 'OBSERVACOES'],
};

// Campos do tipo date — precisam conversão DD/MM/YYYY → YYYY-MM-DD
const DATE_FIELDS = new Set(['data_nascimento', 'cito_lab', 'cito_pep', 'dna_hpv_gal', 'dna_hpv_pep']);

// ─── Helpers (var p/ compat Goja PB v0.39.x) ──────────────

var normalizeHeader = function(h) {
  return h.trim()
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

var findField = function(csvHeader) {
  var n = normalizeHeader(csvHeader);
  if (FIELD_ALIASES[n]) return n;
  for (var fieldName in FIELD_ALIASES) {
    var aliases = FIELD_ALIASES[fieldName];
    for (var ai = 0; ai < aliases.length; ai++) {
      if (normalizeHeader(aliases[ai]) === n) return fieldName;
    }
  }
  for (var fieldName2 in FIELD_ALIASES) {
    var aliases2 = FIELD_ALIASES[fieldName2];
    for (var aj = 0; aj < aliases2.length; aj++) {
      var na = normalizeHeader(aliases2[aj]);
      if (n.includes(na) || na.includes(n)) return fieldName2;
    }
  }
  return null;
};

var parseCSVLine = function(line) {
  var fields = [];
  var cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  fields.push(cur.trim());
  return fields;
};

var parseCSV = function(text) {
  var lines = text.replace(/^\ufeff/, '').replace(/\r/g, '').split('\n').filter(function(l) { return l.trim(); });
  if (lines.length < 2) return { headers: [], rows: [] };

  var rawHeaders = parseCSVLine(lines[0]);
  var headers = [];
  for (var hi = 0; hi < rawHeaders.length; hi++) {
    headers.push(findField(rawHeaders[hi]));
  }
  var rows = [];

  for (var ri = 1; ri < lines.length; ri++) {
    var vals = parseCSVLine(lines[ri]);
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
};

var parseDate = function(str) {
  if (!str || str === '--' || str.trim() === '') return null;
  var s = str.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  var parts = s.split('/');
  if (parts.length === 3) {
    var d = parts[0], m = parts[1], y = parts[2];
    if (y.length === 2) y = '20' + y;
    return y + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0');
  }
  return null;
};

var sanitizeValue = function(field, val) {
  if (val === undefined || val === null) return null;
  var s = String(val).trim();
  if (s === '' || s === '--') return null;
  if (DATE_FIELDS.has(field)) return parseDate(s);
  if (field === 'microarea' || field === 'idade') return parseInt(s, 10) || 0;
  if (field === 'cns') return s.replace(/\D/g, '').padStart(15, '0').slice(-15);
  return s;
};

// ─── Handler legado (var p/ compat Goja PB v0.39.x) ───────

var handleLegacyBody = function(c, body, auth) {
  var records = body.records;
  var fileName = body.fileName || 'import.csv';
  var mode = body.mode === 'append' ? 'append' : 'replace';

  if (records.length > 30000)
    return c.json(413, { code: 413, message: 'Max 30000 registros por lote no modo legado' });

  var dao = $app.dao();
  var collection = dao.findCollectionByNameOrId(COLLECTION);
  if (!collection) return c.json(500, { code: 500, message: 'Collection "' + COLLECTION + '" nao encontrada' });

  var oldCount = 0, newCount = 0;
  var errors = [];

  try {
    dao.runInTransaction(function(txDao) {
      if (mode === 'replace') {
        try {
          var row = txDao.db().newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one();
          oldCount = row && row.get ? (row.get('total') || 0) : 0;
        } catch (_) { oldCount = 0; }
        txDao.db().newQuery('DELETE FROM ' + COLLECTION).execute();
      }

      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        try {
          var rec = txDao.createRecord(collection);
          if (r.unidade) rec.set('unidade', String(r.unidade).trim());
          if (r.equipe) rec.set('equipe', String(r.equipe).trim());
          if (r.microarea !== undefined && r.microarea !== null && r.microarea !== '')
            rec.set('microarea', parseInt(r.microarea, 10) || 0);
          if (r.cns) rec.set('cns', String(r.cns).replace(/\D/g, '').padStart(15, '0').slice(-15));
          if (r.nome) rec.set('nome', String(r.nome).trim());
          if (r.data_nascimento) rec.set('data_nascimento', r.data_nascimento);
          if (r.idade !== undefined && r.idade !== null && r.idade !== '')
            rec.set('idade', parseInt(r.idade, 10) || 0);
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

      if (newCount === 0 && records.length > 0)
        throw new Error('Nenhum registro inserido. Transacao revertida.');
    });
  } catch (e) {
    return c.json(500, {
      code: 500,
      message: (e && e.message) || 'Erro na importacao',
      oldCount: oldCount,
      rollback: true,
    });
  }

  try {
    var logColl = dao.findCollectionByNameOrId(LOG_COLLECTION);
    if (logColl) {
      var log = dao.createRecord(logColl);
      log.set('filename', fileName);
      log.set('total_records', records.length);
      log.set('success_count', newCount);
      log.set('error_count', records.length - newCount);
      log.set('user_id', auth.getId());
      if (errors.length > 0) log.set('details', errors.slice(0, 100).join('\n'));
      dao.saveRecord(log);
    }
  } catch (_) {}

  return c.json(200, {
    success: true,
    mode: mode,
    total: records.length,
    imported: newCount,
    errors: records.length - newCount,
    oldCount: oldCount,
    errorDetails: errors.slice(0, 10),
  });
};

// ─── Router ────────────────────────────────────────────────

routerAdd('POST', '/api/custom/import-pacientes', (c) => {
  try {
    // 1. Auth
    const auth = c.auth;
    if (!auth) return c.json(401, { code: 401, message: 'Não autenticado' });
    const role = auth.get('role');
    if (role !== 'cap' && role !== 'admin')
      return c.json(403, { code: 403, message: 'Apenas usuários CAP ou admin' });

    // 2. Parse body - suporta diferentes versões do PocketBase
    let body;
    try {
      const info = c.requestInfo();
      if (info && info.body) {
        body = (typeof info.body === 'object') ? info.body : {};
        // Se for DynamicModel (tem .get()), converte p/ plain object
        if (body && typeof body.get === 'function') {
          body = {
            csvText: body.get('csvText'),
            fileName: body.get('fileName'),
            records: body.get('records'),
          };
        }
      } else {
        body = {};
      }
    } catch (_) {
      try {
        const raw = c.parseBody();
        body = (typeof raw === 'object' && raw !== null) ? raw : {};
      } catch (_2) {
        body = {};
      }
    }

    // ─── Modo LEGADO: { records } ──────────────────────────────
    if (body.records && Array.isArray(body.records)) {
      return handleLegacyBody(c, body, auth);
    }

    // ─── Modo NOVO: { csvText } ────────────────────────────────
    const csvText = body.csvText;
    if (!csvText || typeof csvText !== 'string' || csvText.trim().length === 0) {
      return c.json(400, { code: 400, message: 'Envie csvText com o conteúdo do CSV' });
    }

    const fileName = body.fileName || 'import.csv';
    const mode = body.mode === 'append' ? 'append' : 'replace'; // append = nao deleta dados antigos

    // 3. Parse CSV
    const { headers, rows } = parseCSV(csvText);
    if (rows.length === 0) {
      return c.json(400, { code: 400, message: 'CSV vazio ou sem dados válidos após o cabeçalho' });
    }

    // 4. Valida campos mapeados
    const mappedFields = headers.filter(Boolean);
    if (!mappedFields.includes('nome') || !mappedFields.includes('cns')) {
      return c.json(400, {
        code: 400,
        message: 'CSV precisa ter colunas mapeáveis para "nome" e "cns". Colunas encontradas: ' +
          JSON.stringify(headers.map((h, i) => ({ csv: parseCSVLine(csvText.split('\n')[0])[i], mapped: h })))
      });
    }

    // 5. Transação — processa em lotes para memória (1GB VM)
    const dao = $app.dao();
    const collection = dao.findCollectionByNameOrId(COLLECTION);
    if (!collection) return c.json(500, { code: 500, message: `Collection "${COLLECTION}" não encontrada` });

    let oldCount = 0, newCount = 0, totalErrors = 0;
    const errorDetails = [];

    // ─── FASE 1: DROP TABLE (impossível ficar parcial) ───
    if (mode === 'replace') {
      // Conta antes
      try {
        const row = dao.db().newQuery(`SELECT COUNT(*) as total FROM ${COLLECTION}`).one();
        oldCount = row?.get('total') || 0;
      } catch (_) { oldCount = 0; }

      // Salva schema da coleção
      const colJSON = collection.export();
      const colFields = JSON.parse(colJSON).fields;
      const colIndexes = collection.indexes ? collection.indexes() : [];

      // DROP TABLE
      dao.db().newQuery(`DROP TABLE IF EXISTS ${COLLECTION}`).execute();
      console.log(`[import-pacientes] DROP TABLE ${COLLECTION}: ${oldCount} registros destruídos`);

      // Recria tabela com mesma estrutura
      const fieldDefs = colFields.map(f => {
        let colType = 'TEXT';
        if (f.type === 'number') colType = 'REAL DEFAULT 0';
        else if (f.type === 'bool') colType = 'INTEGER DEFAULT 0';
        else if (f.type === 'file') colType = 'TEXT DEFAULT \'\'';
        return `"${f.name}" ${colType}`;
      }).join(', ');
      dao.db().newQuery(`CREATE TABLE IF NOT EXISTS "${COLLECTION}" (id TEXT PRIMARY KEY, created TEXT DEFAULT (datetime(\'now\')), updated TEXT DEFAULT (datetime(\'now\')), ${fieldDefs})`).execute();

      // Recria collection no PocketBase (metadados)
      dao.saveCollection(collection);

      console.log(`[import-pacientes] Tabela recriada com ${colFields.length} campos`);
    }

    // ─── FASE 2: INSERT dentro da transação ───
    if (rows.length > 0) {
      // Rebusca collection (pode ter sido recriada)
      const freshCollection = dao.findCollectionByNameOrId(COLLECTION);

      try {
        dao.runInTransaction((txDao) => {
          for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            for (let j = 0; j < batch.length; j++) {
              const r = batch[j];
              try {
                const rec = txDao.createRecord(freshCollection);
                for (const field of mappedFields) {
                  const val = sanitizeValue(field, r[field]);
                  if (val !== null) rec.set(field, val);
                }
                txDao.saveRecord(rec);
                newCount++;
              } catch (e) {
                totalErrors++;
                const errMsg = (e && e.message) || 'Erro desconhecido';
                errorDetails.push(`#${i + j + 1} ${r.cns || r.nome || '?'}: ${errMsg}`);
              }
            }
          }

          if (newCount === 0 && rows.length > 0)
            throw new Error('Nenhum registro inserido. Transação revertida.');
        });
      } catch (e) {
        const msg = (e && e.message) || 'Erro na importação';
        console.error('[import-pacientes] INSERT falhou:', msg);
        return c.json(500, {
          code: 500,
          message: 'Tabela recriada mas INSERT falhou: ' + msg,
          oldCount,
          imported: 0,
          errors: totalErrors || rows.length,
          rollback: false,
        });
      }
    }

    // 6. Log
    try {
      const logColl = dao.findCollectionByNameOrId(LOG_COLLECTION);
      if (logColl) {
        const log = dao.createRecord(logColl);
        log.set('filename', fileName);
        log.set('total_records', rows.length);
        log.set('success_count', newCount);
        log.set('error_count', totalErrors);
        log.set('user_id', auth.getId());
        if (errorDetails.length > 0)
          log.set('details', errorDetails.slice(0, 100).join('\n'));
        dao.saveRecord(log);
      }
    } catch (_) {}

    return c.json(200, {
      success: true,
      mode,
      total: rows.length,
      imported: newCount,
      errors: totalErrors,
      oldCount,
      mappedFields: mappedFields,
      errorDetails: errorDetails.slice(0, 10),
    });
  } catch (unexpectedErr) {
    // Garante que erros inesperados nao caiam no generic "Something went wrong" do PB
    const msg = (unexpectedErr && unexpectedErr.message) || 'Erro inesperado no servidor';
    console.error('import-pacientes CRASH:', msg);
    return c.json(500, { code: 500, message: msg });
  }
});

// ─── DELETE em massa: remove TODOS os registros de uma coleção ───
// POST /api/custom/delete-all  { collection: "amarcap53_pacientes" }
// Apenas cap/admin. SQL direto = instantâneo.
routerAdd('POST', '/api/custom/delete-all', (c) => {
  try {
    const auth = c.auth;
    if (!auth) return c.json(401, { code: 401, message: 'Não autenticado' });
    const role = auth.get('role');
    if (role !== 'cap' && role !== 'admin')
      return c.json(403, { code: 403, message: 'Apenas usuários CAP ou admin' });

    let body;
    try {
      const info = c.requestInfo();
      if (info && info.body) {
        body = (typeof info.body === 'object') ? info.body : {};
        if (body && typeof body.get === 'function') {
          body = { collection: body.get('collection') };
        }
      } else {
        body = {};
      }
    } catch (_) {
      try {
        const raw = c.parseBody();
        body = (typeof raw === 'object' && raw !== null) ? raw : {};
      } catch (_2) {
        body = {};
      }
    }

    const collection = body.collection;
    if (!collection || typeof collection !== 'string')
      return c.json(400, { code: 400, message: 'Envie collection nome' });

    // Valida que a coleção existe
    const dao = $app.dao();
    const col = dao.findCollectionByNameOrId(collection);
    if (!col) return c.json(404, { code: 404, message: 'Coleção "' + collection + '" não encontrada' });

    // Conta antes
    let beforeCount = 0;
    try {
      const row = dao.db().newQuery('SELECT COUNT(*) as total FROM ' + collection).one();
      beforeCount = row && row.get ? (row.get('total') || 0) : 0;
    } catch (_) {}

    // DELETE em massa via SQL
    dao.db().newQuery('DELETE FROM ' + collection).execute();

    console.log('[delete-all] ' + collection + ': ' + beforeCount + ' registros removidos');
    return c.json(200, { success: true, deleted: beforeCount });
  } catch (err) {
    const msg = (err && err.message) || 'Erro ao deletar registros';
    console.error('[delete-all] CRASH:', msg);
    return c.json(500, { code: 500, message: msg });
  }
});

// ─── HOOK: auto-delete antigos quando frontend cria registros 1 por 1 ───
// Quando "Substituir existentes" está marcado, frontend antigo faz:
//   delete sequencial (Promise.allSettled) + create 1 por 1.
// Este hook intercepta o PRIMEIRO create e deleta TODOS os antigos de uma vez.
// Funciona com qualquer build do frontend.

var _autoDeleteDone = false;

onRecordBeforeCreateRequest((e) => {
  if (!e.record || e.record.collection().name !== COLLECTION) {
    return e.next();
  }
  if (_autoDeleteDone) {
    return e.next();
  }

  console.log('[auto-delete] Primeiro create detectado — limpando ' + COLLECTION + '...');

  try {
    var dao = $app.dao();
    var total = 0;
    try {
      var row = dao.db().newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one();
      total = (row && row.get) ? (row.get('total') || 0) : 0;
    } catch (_) {}

    if (total === 0) {
      _autoDeleteDone = true;
      return e.next();
    }

    // DELETE em batch até vazio
    var maxIter = 200;
    var iter = 0;
    while (iter < maxIter) {
      var check = dao.db().newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one();
      var rem = (check && check.get) ? (check.get('total') || 0) : 0;
      if (rem === 0) break;
      dao.db().newQuery('DELETE FROM ' + COLLECTION + ' WHERE id IN (SELECT id FROM ' + COLLECTION + ' LIMIT 10000)').execute();
      iter++;
    }

    var finalCheck = dao.db().newQuery('SELECT COUNT(*) as total FROM ' + COLLECTION).one();
    var leftover = (finalCheck && finalCheck.get) ? (finalCheck.get('total') || 0) : 0;

    _autoDeleteDone = true;

    if (leftover > 0) {
      console.error('[auto-delete] ERRO: ' + leftover + ' registros restaram');
    } else {
      console.log('[auto-delete] OK: ' + total + ' registros destruidos. Colecao vazia.');
    }
  } catch (err) {
    console.error('[auto-delete] Erro:', (err && err.message) || err);
  }

  return e.next();
}, COLLECTION);


