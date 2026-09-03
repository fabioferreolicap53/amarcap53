// acompanhamento_cns.pb.js
// Solução: campo CNS nos acompanhamentos para re-vinculação
// SEM HOOKS — frontend envia cns diretamente

// ═══════════════════════════════════════════════════════
// 1. MIGRATION: popular cns nos acompanhamentos existentes
// ═══════════════════════════════════════════════════════
routerAdd('POST', '/api/custom/migrate-acompanhamento-cns', function(c) {
  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { message: 'Nao autenticado' });

    var db = $app.db();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    // Atualizar cns de todos acompanhamentos que têm paciente vinculado
    db.newQuery(
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
    return c.json(500, { message: (err && err.message) ? err.message : 'Erro' });
  }
});

// ═══════════════════════════════════════════════════════
// 2. RE-LINK: re-vincula huérfãos por CNS após delete+import
// ═══════════════════════════════════════════════════════
routerAdd('POST', '/api/custom/relink-by-cns', function(c) {
  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { message: 'Nao autenticado' });

    var db = $app.db();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    // Buscar acompanhamentos huérfãos com cns preenchido
    var orphans = db.newQuery(
      'SELECT a.id, a.cns, a.paciente FROM amarcap53_acompanhamentos a ' +
      'WHERE a.cns IS NOT NULL AND a.cns != "" AND (' +
      '  a.paciente IS NULL OR a.paciente = "" OR NOT EXISTS (' +
      '    SELECT 1 FROM amarcap53_pacientes p WHERE p.id = a.paciente' +
      '  )' +
      ')'
    ).all();

    if (orphans.length === 0) {
      return c.json(200, { success: true, relinked: 0, message: 'Nenhum huérfão' });
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
        pacByCns[String(pacRows[i].get('cns'))] = pacRows[i].get('id');
      }
      if (pacRows.length < 500) break;
      offset += 500;
    }

    // Re-vincular
    var relinked = 0;
    for (var j = 0; j < orphans.length; j++) {
      var orphCns = String(orphans[j].get('cns') || '');
      var orphId = orphans[j].get('id');
      if (!orphCns || !pacByCns[orphCns]) continue;
      try {
        db.newQuery(
          'UPDATE amarcap53_acompanhamentos SET paciente = \'' + pacByCns[orphCns] + '\' WHERE id = \'' + orphId + '\''
        ).execute();
        relinked++;
      } catch(_) {}
    }

    return c.json(200, { success: true, relinked: relinked });
  } catch(err) {
    return c.json(500, { message: (err && err.message) ? err.message : 'Erro' });
  }
});
