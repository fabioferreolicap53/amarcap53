// acompanhamento_cns.pb.js
// Solução definitiva: campo CNS nos acompanhamentos
// Goja engine (ES5)

// ═══════════════════════════════════════════════════════
// 1. MIGRATION: popular cns nos acompanhamentos existentes
// ═══════════════════════════════════════════════════════
routerAdd('POST', '/api/custom/migrate-acompanhamento-cns', function(c) {
  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { message: 'Nao autenticado' });

    var db = $app.db();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    var result = db.newQuery(
      'UPDATE amarcap53_acompanhamentos SET cns = (' +
      '  SELECT p.cns FROM amarcap53_pacientes p WHERE p.id = amarcap53_acompanhamentos.paciente' +
      ') WHERE paciente IS NOT NULL AND paciente != "" AND EXISTS (' +
      '  SELECT 1 FROM amarcap53_pacientes p WHERE p.id = amarcap53_acompanhamentos.paciente AND p.cns IS NOT NULL AND p.cns != ""' +
      ')'
    ).execute();

    var count = db.newQuery(
      'SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos WHERE cns IS NOT NULL AND cns != ""'
    ).all();
    var total = (count.length > 0) ? count[0].get('cnt') : 0;

    return c.json(200, { success: true, totalComCns: total });

  } catch(err) {
    var msg = (err && err.message) ? err.message : 'Erro';
    console.error('migrate-acompanhamento-cns:', msg);
    return c.json(500, { message: msg });
  }
});

// ═══════════════════════════════════════════════════════
// 2. HOOK: beforeCreate - preenche cns automaticamente
//    Versão ultra-safe: se qualquer erro, apenas loga
// ═══════════════════════════════════════════════════════
onRecordCreate(function(e) {
  try {
    var rec = e.record;
    if (!rec) return;

    // Pegar nome da coleção de forma segura
    var col = null;
    try { col = rec.collection(); } catch(_) {}
    if (!col) return;
    var colName = '';
    try { colName = col.name || ''; } catch(_) {}
    if (colName !== 'amarcap53_acompanhamentos') return;

    // Se já tem cns, não fazer nada
    var currentCns = '';
    try { currentCns = rec.get('cns') || ''; } catch(_) {}
    if (currentCns && String(currentCns).trim() !== '') return;

    // Buscar ID do paciente
    var pacienteId = '';
    try { pacienteId = rec.get('paciente') || ''; } catch(_) {}
    if (!pacienteId || String(pacienteId).trim() === '') return;

    // Buscar CNS do paciente via DAO
    try {
      var dao = $app.dao();
      if (!dao) return;
      var pacRecord = dao.findRecordById('amarcap53_pacientes', pacienteId);
      if (!pacRecord) return;
      var pacCns = pacRecord.get('cns') || '';
      if (pacCns && String(pacCns).trim() !== '') {
        rec.set('cns', String(pacCns));
      }
    } catch(_) {
      // Se DAO falhar, tentar via DB
      try {
        var db = $app.db();
        if (!db) return;
        var rows = db.newQuery(
          'SELECT cns FROM amarcap53_pacientes WHERE id = \'' + pacienteId + '\' AND cns IS NOT NULL AND cns != \'\' LIMIT 1'
        ).all();
        if (rows.length > 0) {
          var cnsVal = rows[0].get('cns');
          if (cnsVal) rec.set('cns', String(cnsVal));
        }
      } catch(_) {}
    }
  } catch(err) {
    // NUNCA impedir o salvamento — apenas logar
    console.error('HOOK cns:', (err && err.message) ? err.message : String(err));
  }
}, 'amarcap53_acompanhamentos');

// ═══════════════════════════════════════════════════════
// 3. RE-LINK: re-vincula huérfãos por CNS
// ═══════════════════════════════════════════════════════
routerAdd('POST', '/api/custom/relink-by-cns', function(c) {
  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { message: 'Nao autenticado' });

    var db = $app.db();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    var orphans = db.newQuery(
      'SELECT a.id, a.cns, a.paciente FROM amarcap53_acompanhamentos a ' +
      'WHERE a.cns IS NOT NULL AND a.cns != "" AND (' +
      '  a.paciente IS NULL OR a.paciente = "" OR NOT EXISTS (' +
      '    SELECT 1 FROM amarcap53_pacientes p WHERE p.id = a.paciente' +
      '  )' +
      ')'
    ).all();

    if (orphans.length === 0) {
      return c.json(200, { success: true, relinked: 0, message: 'Nenhum huérfão com cns encontrado' });
    }

    // Indexar pacientes novos por cns
    var pacByCns = {};
    var offset = 0;
    while (true) {
      var pacRows = db.newQuery(
        'SELECT id, cns FROM amarcap53_pacientes WHERE cns IS NOT NULL AND cns != "" LIMIT 500 OFFSET ' + offset
      ).all();
      if (pacRows.length === 0) break;
      for (var i = 0; i < pacRows.length; i++) {
        var cns = String(pacRows[i].get('cns'));
        var id = pacRows[i].get('id');
        pacByCns[cns] = id;
      }
      if (pacRows.length < 500) break;
      offset += 500;
    }

    // Re-vincular
    var relinked = 0;
    var failed = 0;

    for (var j = 0; j < orphans.length; j++) {
      var orph = orphans[j];
      var orphCns = String(orph.get('cns') || '');
      var orphId = orph.get('id');

      if (!orphCns || !pacByCns[orphCns]) { failed++; continue; }

      var newPacId = pacByCns[orphCns];

      try {
        db.newQuery(
          'UPDATE amarcap53_acompanhamentos SET paciente = \'' + newPacId + '\' WHERE id = \'' + orphId + '\''
        ).execute();
        relinked++;
      } catch(_) { failed++; }
    }

    return c.json(200, {
      success: true,
      relinked: relinked,
      failed: failed,
      totalOrphans: orphans.length,
      totalPacientes: Object.keys(pacByCns).length
    });

  } catch(err) {
    var msg = (err && err.message) ? err.message : 'Erro';
    console.error('relink-by-cns:', msg);
    return c.json(500, { message: msg });
  }
});
