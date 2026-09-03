// acompanhamento_cns.pb.js
// Solução: campo CNS nos acompanhamentos para re-vinculação
// SEM HOOKS — frontend envia cns diretamente

// ═══════════════════════════════════════════════════════
// 1. DIAGNÓSTICO: ver estado dos dados
// ═══════════════════════════════════════════════════════
routerAdd('GET', '/api/custom/diag-acompanhamentos', function(c) {
  try {
    var db = $app.db();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    var total = db.newQuery('SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos').all();
    var comCns = db.newQuery('SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos WHERE cns IS NOT NULL AND cns != ""').all();
    var comPaciente = db.newQuery('SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos WHERE paciente IS NOT NULL AND paciente != ""').all();
    var huertoComCns = db.newQuery(
      'SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos a ' +
      'WHERE a.cns IS NOT NULL AND a.cns != "" AND (' +
      'a.paciente IS NULL OR a.paciente = "" OR NOT EXISTS (' +
      'SELECT 1 FROM amarcap53_pacientes p WHERE p.id = a.paciente))'
    ).all();
    var huertoSemCns = db.newQuery(
      'SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos a ' +
      'WHERE (a.cns IS NULL OR a.cns = "") AND (' +
      'a.paciente IS NULL OR a.paciente = "" OR NOT EXISTS (' +
      'SELECT 1 FROM amarcap53_pacientes p WHERE p.id = a.paciente))'
    ).all();
    var totalPac = db.newQuery('SELECT COUNT(*) as cnt FROM amarcap53_pacientes').all();
    var pacComCns = db.newQuery('SELECT COUNT(*) as cnt FROM amarcap53_pacientes WHERE cns IS NOT NULL AND cns != ""').all();

    // Amostra de huérfãos com cns
    var amostra = db.newQuery(
      'SELECT a.id, a.cns, a.paciente FROM amarcap53_acompanhamentos a ' +
      'WHERE a.cns IS NOT NULL AND a.cns != "" AND (' +
      'a.paciente IS NULL OR a.paciente = "" OR NOT EXISTS (' +
      'SELECT 1 FROM amarcap53_pacientes p WHERE p.id = a.paciente)) LIMIT 5'
    ).all();
    var amostraData = [];
    for (var i = 0; i < amostra.length; i++) {
      amostraData.push({
        id: amostra[i].get('id'),
        cns: amostra[i].get('cns'),
        paciente: amostra[i].get('paciente')
      });
    }

    return c.json(200, {
      acompanhamentos: {
        total: total.length > 0 ? total[0].get('cnt') : 0,
        comCns: comCns.length > 0 ? comCns[0].get('cnt') : 0,
        comPaciente: comPaciente.length > 0 ? comPaciente[0].get('cnt') : 0,
        huertoComCns: huertoComCns.length > 0 ? huertoComCns[0].get('cnt') : 0,
        huertoSemCns: huertoSemCns.length > 0 ? huertoSemCns[0].get('cnt') : 0,
      },
      pacientes: {
        total: totalPac.length > 0 ? totalPac[0].get('cnt') : 0,
        comCns: pacComCns.length > 0 ? pacComCns[0].get('cnt') : 0,
      },
      amostraHuertoComCns: amostraData
    });
  } catch(err) {
    return c.json(500, { message: (err && err.message) ? err.message : 'Erro' });
  }
});

// ═══════════════════════════════════════════════════════
// 2. FIX: re-vincula TODOS os huérfãos
//    2a. Preenche cns de huérfãos sem cns usando backup do frontend
//    2b. Re-vincula huérfãos com cns usando matching cns→paciente
//    Aceita body JSON: { "oldPatientCnsMap": { "oldId": "cns" } }
// ═══════════════════════════════════════════════════════
routerAdd('POST', '/api/custom/relink-by-cns', function(c) {
  try {
    var db = $app.db();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    // Ler body de forma robusta
    var oldMap = {};
    try {
      var raw = c.requestInfo().rawBody || '';
      if (raw && raw.length > 2) {
        var parsed = JSON.parse(raw);
        oldMap = parsed.oldPatientCnsMap || {};
      }
    } catch(_) {
      try {
        var info = c.requestInfo();
        if (info && info.body) {
          var b = info.body;
          oldMap = (typeof b.get === 'function') ? (b.get('oldPatientCnsMap') || {}) : (b.oldPatientCnsMap || {});
        }
      } catch(_) {}
    }

    var filled = 0;
    var relinked = 0;

    // PASSO 1: Preencher cns em huérfãos que não têm cns mas têm paciente antigo
    if (oldMap && typeof oldMap === 'object') {
      var keys = [];
      try { keys = Object.keys(oldMap); } catch(_) {}
      if (keys.length > 0) {
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

// ═══════════════════════════════════════════════════════
// 3. MIGRATION: popular cns nos acompanhamentos existentes
// ═══════════════════════════════════════════════════════
routerAdd('POST', '/api/custom/migrate-acompanhamento-cns', function(c) {
  try {
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
