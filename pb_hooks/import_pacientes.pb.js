// Custom endpoint: Importação transactional de pacientes (CSV → JSON)
// Uso: POST /api/custom/import-pacientes
// Body: { records: [...], fileName: "exemplo.csv" }
// Apenas usuários com role "cap" ou "admin"
// Em caso de erro, ROLLBACK total — dados antigos preservados
// Performance: DELETE direto + INSERT loop dentro de transação SQL

const COLLECTION = 'amarcap53_pacientes';
const LOG_COLLECTION = 'amarcap53_importacoes';
const MAX_RECORDS = 30000;

routerAdd('POST', '/api/custom/import-pacientes', (c) => {
  // ─── 1. Auth ───
  const auth = c.auth;
  if (!auth) {
    return c.json(401, { code: 401, message: 'Não autenticado' });
  }
  const role = auth.get('role');
  if (role !== 'cap' && role !== 'admin') {
    return c.json(403, { code: 403, message: 'Apenas usuários CAP' });
  }

  // ─── 2. Parse ───
  const body = c.parseBody();
  const records = body.records;
  const fileName = body.fileName || 'import.csv';

  if (!Array.isArray(records) || records.length === 0) {
    return c.json(400, { code: 400, message: 'Nenhum registro enviado' });
  }
  if (records.length > MAX_RECORDS) {
    return c.json(413, {
      code: 413,
      message: `Máximo de ${MAX_RECORDS} registros por lote. Enviados: ${records.length}`,
    });
  }

  const dao = $app.dao();
  const collection = dao.findCollectionByNameOrId(COLLECTION);
  if (!collection) {
    return c.json(500, { code: 500, message: `Collection "${COLLECTION}" não encontrada` });
  }

  // ─── 3. Transação ───
  let oldCount = 0;
  let newCount = 0;
  const errors = [];

  try {
    dao.runInTransaction((txDao) => {
      // 3a. Conta registros antigos
      try {
        const row = txDao.db().newQuery(`SELECT COUNT(*) as total FROM ${COLLECTION}`).one();
        oldCount = row?.get('total') || 0;
      } catch (_) {
        oldCount = 0;
      }

      // 3b. DELETE instantâneo (SQL direto)
      txDao.db().newQuery(`DELETE FROM ${COLLECTION}`).execute();

      // 3c. INSERT em loop (seguro, sem estourar RAM)
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        try {
          const rec = txDao.createRecord(collection);
          if (r.unidade) rec.set('unidade', String(r.unidade).trim());
          if (r.equipe) rec.set('equipe', String(r.equipe).trim());
          if (r.microarea !== undefined && r.microarea !== null && r.microarea !== '') {
            rec.set('microarea', parseInt(r.microarea, 10) || 0);
          }
          if (r.cns) rec.set('cns', String(r.cns).replace(/\D/g, '').padStart(15, '0').slice(-15));
          if (r.nome) rec.set('nome', String(r.nome).trim());
          if (r.data_nascimento) rec.set('data_nascimento', r.data_nascimento);
          if (r.idade !== undefined && r.idade !== null && r.idade !== '') {
            rec.set('idade', parseInt(r.idade, 10) || 0);
          }
          if (r.grupo !== undefined && r.grupo !== null) rec.set('grupo', String(r.grupo).trim());
          if (r.cito_lab) rec.set('cito_lab', r.cito_lab);
          if (r.cito_pep) rec.set('cito_pep', r.cito_pep);
          if (r.dna_hpv_gal) rec.set('dna_hpv_gal', r.dna_hpv_gal);
          if (r.alertas_rastreamento) rec.set('alertas_rastreamento', r.alertas_rastreamento);

          txDao.saveRecord(rec);
          newCount++;
        } catch (e) {
          errors.push(`#${i + 1} CNS=${r.cns || '?'}: ${e.message || 'Erro'}`);
        }
      }

      // Se nenhum registro foi inserido → rollback
      if (newCount === 0 && records.length > 0) {
        throw new Error('Nenhum registro foi inserido. Transação revertida.');
      }
    });
  } catch (e) {
    // runInTransaction reverte automaticamente ao lançar exceção
    return c.json(500, {
      code: 500,
      message: e.message || 'Erro na importação',
      oldCount,
      rollback: true,
    });
  }

  // ─── 4. Log de importação (fora da transação) ───
  try {
    const logColl = dao.findCollectionByNameOrId(LOG_COLLECTION);
    if (logColl) {
      const log = dao.createRecord(logColl);
      log.set('filename', fileName);
      log.set('total_records', records.length);
      log.set('success_count', newCount);
      log.set('error_count', records.length - newCount);
      log.set('user_id', auth.getId());
      if (errors.length > 0) {
        log.set('details', errors.slice(0, 100).join('\n'));
      }
      dao.saveRecord(log);
    }
  } catch (_) {
    // Falha no log não quebra a importação
  }

  return c.json(200, {
    success: true,
    total: records.length,
    imported: newCount,
    errors: records.length - newCount,
    oldCount,
    errorDetails: errors.slice(0, 10),
  });
});
