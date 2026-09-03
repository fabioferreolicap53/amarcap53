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
// 2. RE-LINK: re-vincula huérfãos por CNS
//    Aceita oldPatientCnsMap para preencher cns em huérfãos
// ═══════════════════════════════════════════════════════
routerAdd('POST', '/api/custom/relink-by-cns', function(c) {
  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { message: 'Nao autenticado' });

    var db = $app.db();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    // Body pode conter oldPatientCnsMap: { oldPacienteId: cns }
    var body = {};
    try { body = c.parseBody() || {}; } catch(_) {}
    if (!body.oldPatientCnsMap) {
      try {
        var info = c.requestInfo();
        if (info && info.body && typeof info.body === 'object') {
          body.oldPatientCnsMap = (typeof info.body.get === 'function') ? info.body.get('oldPatientCnsMap') : info.body.oldPatientCnsMap;
        }
      } catch(_) {}
    }
    var oldMap = body.oldPatientCnsMap || {};

    var filled = 0;
    var relinked = 0;

    // PASSO 1: Preencher cns em huérfãos que não têm cns mas têm paciente antigo
    // Se o acompanhamento tem paciente = "oldId" (dead) e cns vazio,
    // usar oldMap para preencher o cns
    if (oldMap && typeof oldMap === 'object') {
      var noCnsOrphans = db.newQuery(
        'SELECT a.id, a.paciente FROM amarcap53_acompanhamentos a ' +
        'WHERE (a.cns IS NULL OR a.cns = "") AND ' +
        'a.paciente IS NOT NULL AND a.paciente != "" AND NOT EXISTS (' +
        '  SELECT 1 FROM amarcap53_pacientes p WHERE p.id = a.paciente' +
        ')'
      ).all();

      for (var i = 0; i < noCnsOrphans.length; i++) {
        var orphId = noCnsOrphans[i].get('id');
        var oldPacId = noCnsOrphans[i].get('paciente');
        var cnsForOld = oldMap[oldPacId];
        if (!cnsForOld) continue;
        try {
          db.newQuery(
            'UPDATE amarcap53_acompanhamentos SET cns = \'' + cnsForOld + '\' WHERE id = \'' + orphId + '\''
          ).execute();
          filled++;
        } catch(_) {}
      }
    }

    // PASSO 2: Re-vincular TODOS os huérfãos que têm cns
    var orphans = db.newQuery(
      'SELECT a.id, a.cns FROM amarcap53_acompanhamentos a ' +
      'WHERE a.cns IS NOT NULL AND a.cns != "" AND (' +
      '  a.paciente IS NULL OR a.paciente = "" OR NOT EXISTS (' +
      '    SELECT 1 FROM amarcap53_pacientes p WHERE p.id = a.paciente' +
      '  )' +
      ')'
    ).all();

    // Indexar pacientes novos por cns
    var pacByCns = {};
    var offset = 0;
    while (true) {
      var pacRows = db.newQuery(
        'SELECT id, cns FROM amarcap53_pacientes WHERE cns IS NOT NULL AND cns != "" LIMIT 500 OFFSET ' + offset
      ).all();
      if (pacRows.length === 0) break;
      for (var j = 0; j < pacRows.length; j++) {
        pacByCns[String(pacRows[j].get('cns'))] = pacRows[j].get('id');
      }
      if (pacRows.length < 500) break;
      offset += 500;
    }

    for (var k = 0; k < orphans.length; k++) {
      var oCns = String(orphans[k].get('cns') || '');
      var oId = orphans[k].get('id');
      if (!oCns || !pacByCns[oCns]) continue;
      try {
        db.newQuery(
          'UPDATE amarcap53_acompanhamentos SET paciente = \'' + pacByCns[oCns] + '\' WHERE id = \'' + oId + '\''
        ).execute();
        relinked++;
      } catch(_) {}
    }

    return c.json(200, { success: true, filled: filled, relinked: relinked });
  } catch(err) {
    return c.json(500, { message: (err && err.message) ? err.message : 'Erro' });
  }
});
