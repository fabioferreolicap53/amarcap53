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

// ─── Helpers ───────────────────────────────────────────────

function normalizeHeader(h) {
  return h.trim()
    .toUpperCase()
    .replace(/[^\w\s]/g, ' ')   // pontuação → espaço
    .replace(/\s+/g, ' ')       // colapsa espaços
    .trim();
}

function findField(csvHeader) {
  const n = normalizeHeader(csvHeader);
  // Exact match direto no nome do campo
  if (FIELD_ALIASES[n]) return n;
  // Check aliases
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const a of aliases) {
      if (normalizeHeader(a) === n) return field;
    }
  }
  // Contains match
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const a of aliases) {
      const na = normalizeHeader(a);
      if (n.includes(na) || na.includes(n)) return field;
    }
  }
  return null;
}

// CSV line parser — respeita aspas duplas
function parseCSVLine(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  fields.push(cur.trim());
  return fields;
}

// Parse CSV completo → { headers: [CampoPB, ...], rows: [{ CampoPB: valor }] }
function parseCSV(text) {
  const lines = text.replace(/^\ufeff/, '').replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const rawHeaders = parseCSVLine(lines[0]);
  const headers = rawHeaders.map(h => findField(h));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const row = {};
    let hasData = false;
    for (let j = 0; j < headers.length && j < vals.length; j++) {
      if (!headers[j]) continue; // coluna sem mapeamento
      row[headers[j]] = vals[j] || '';
      if (vals[j] && vals[j].trim()) hasData = true;
    }
    if (hasData) rows.push(row);
  }

  return { headers, rows };
}

function parseDate(str) {
  if (!str || str === '--' || str.trim() === '') return null;
  const s = str.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  const parts = s.split('/');
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function sanitizeValue(field, val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (s === '' || s === '--') return null;
  if (DATE_FIELDS.has(field)) return parseDate(s);
  if (field === 'microarea' || field === 'idade') return parseInt(s, 10) || 0;
  if (field === 'cns') return s.replace(/\D/g, '').padStart(15, '0').slice(-15);
  return s;
}

// ─── Router ────────────────────────────────────────────────

routerAdd('POST', '/api/custom/import-pacientes', (c) => {
  // 1. Auth
  const auth = c.auth;
  if (!auth) return c.json(401, { code: 401, message: 'Não autenticado' });
  const role = auth.get('role');
  if (role !== 'cap' && role !== 'admin')
    return c.json(403, { code: 403, message: 'Apenas usuários CAP ou admin' });

  // 2. Parse body
  let body;
  try {
    const info = c.requestInfo();
    body = (info && typeof info.body === 'object' && info.body !== null) ? info.body : {};
  } catch (_) {
    try { body = c.parseBody(); } catch (_) { body = {}; }
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

  try {
    dao.runInTransaction((txDao) => {
      // Conta + remove dados antigos
      try {
        const row = txDao.db().newQuery(`SELECT COUNT(*) as total FROM ${COLLECTION}`).one();
        oldCount = row?.get('total') || 0;
      } catch (_) { oldCount = 0; }
      txDao.db().newQuery(`DELETE FROM ${COLLECTION}`).execute();

      // Processa em lotes
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        for (let j = 0; j < batch.length; j++) {
          const r = batch[j];
          try {
            const rec = txDao.createRecord(collection);
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
    return c.json(500, {
      code: 500,
      message: (e && e.message) || 'Erro na importação',
      oldCount,
      rollback: true,
    });
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
    mode: 'replace',
    total: rows.length,
    imported: newCount,
    errors: totalErrors,
    oldCount,
    mappedFields: mappedFields,
    errorDetails: errorDetails.slice(0, 10),
  });
});

// ─── Handler legado (mesma lógica de antes) ────────────────

function handleLegacyBody(c, body, auth) {
  const records = body.records;
  const fileName = body.fileName || 'import.csv';
  const mode = body.mode === 'append' ? 'append' : 'replace';

  if (records.length > 30000)
    return c.json(413, { code: 413, message: 'Máx 30000 registros por lote no modo legado' });

  const dao = $app.dao();
  const collection = dao.findCollectionByNameOrId(COLLECTION);
  if (!collection) return c.json(500, { code: 500, message: `Collection "${COLLECTION}" não encontrada` });

  let oldCount = 0, newCount = 0;
  const errors = [];

  try {
    dao.runInTransaction((txDao) => {
      if (mode === 'replace') {
        try {
          const row = txDao.db().newQuery(`SELECT COUNT(*) as total FROM ${COLLECTION}`).one();
          oldCount = row?.get('total') || 0;
        } catch (_) { oldCount = 0; }
        txDao.db().newQuery(`DELETE FROM ${COLLECTION}`).execute();
      }

      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        try {
          const rec = txDao.createRecord(collection);
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
          errors.push(`#${i + 1} CNS=${r.cns || '?'}: ${(e && e.message) || 'Erro'}`);
        }
      }

      if (newCount === 0 && records.length > 0)
        throw new Error('Nenhum registro inserido. Transação revertida.');
    });
  } catch (e) {
    return c.json(500, {
      code: 500,
      message: (e && e.message) || 'Erro na importação',
      oldCount,
      rollback: true,
    });
  }

  try {
    const logColl = dao.findCollectionByNameOrId(LOG_COLLECTION);
    if (logColl) {
      const log = dao.createRecord(logColl);
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
    mode,
    total: records.length,
    imported: newCount,
    errors: records.length - newCount,
    oldCount,
    errorDetails: errors.slice(0, 10),
  });
}
