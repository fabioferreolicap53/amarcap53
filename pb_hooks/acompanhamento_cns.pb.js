// acompanhamento_cns.pb.js
// Solução definitiva: campo CNS nos acompanhamentos
//
// 1. Migration: popular cns em acompanhamentos existentes
// 2. Hook: beforeCreate preenche cns automaticamente
// 3. Re-link: re-vincula huérfãos por CNS após delete+import de pacientes

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
    // e cujo paciente tem cns
    var result = db.newQuery(
      'UPDATE amarcap53_acompanhamentos SET cns = (' +
      '  SELECT p.cns FROM amarcap53_pacientes p WHERE p.id = amarcap53_acompanhamentos.paciente' +
      ') WHERE paciente IS NOT NULL AND paciente != "" AND EXISTS (' +
      '  SELECT 1 FROM amarcap53_pacientes p WHERE p.id = amarcap53_acompanhamentos.paciente AND p.cns IS NOT NULL AND p.cns != ""' +
      ')'
    ).execute();

    // Contar quantos foram atualizados
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
// ═══════════════════════════════════════════════════════
onRecordCreate(function(e) {
  try {
    // Só para amarcap53_acompanhamentos
    var collection = e.record.collection().name;
    if (collection !== 'amarcap53_acompanhamentos') return;

    // Se já tem cns, não sobrescrever
    var existingCns = e.record.get('cns');
    if (existingCns && String(existingCns).trim() !== '') return;

    // Buscar paciente para pegar cns
    var pacienteId = e.record.get('paciente');
    if (!pacienteId || String(pacienteId).trim() === '') return;

    var db = $app.db();
    if (!db) return;

    var pacRows = db.newQuery(
      'SELECT cns FROM amarcap53_pacientes WHERE id = "' + pacienteId + '" AND cns IS NOT NULL AND cns != "" LIMIT 1'
    ).all();

    if (pacRows.length > 0) {
      var cns = pacRows[0].get('cns');
      if (cns) e.record.set('cns', String(cns));
    }
  } catch(err) {
    console.error('beforeCreate acompanhamento cns:', (err && err.message) ? err.message : err);
  }
}, 'amarcap53_acompanhamentos');

// ═══════════════════════════════════════════════════════
// 3. RE-LINK: re-vincula huérfãos por CNS após delete+import
// ═══════════════════════════════════════════════════════
routerAdd('POST', '/api/custom/relink-by-cns', function(c) {
  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { message: 'Nao autenticado' });

    var db = $app.db();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    var ACOMP = 'amarcap53_acompanhamentos';
    var PAC = 'amarcap53_pacientes';

    // 1. Buscar acompanhamentos huérfãos (paciente = null/"" ou ID morto)
    //    QUE TENHAM campo cns preenchido
    var orphans = db.newQuery(
      'SELECT a.id, a.cns, a.paciente FROM ' + ACOMP + ' a ' +
      'WHERE a.cns IS NOT NULL AND a.cns != "" AND (' +
      '  a.paciente IS NULL OR a.paciente = "" OR NOT EXISTS (' +
      '    SELECT 1 FROM ' + PAC + ' p WHERE p.id = a.paciente' +
      '  )' +
      ')'
    ).all();

    if (orphans.length === 0) {
      return c.json(200, { success: true, relinked: 0, message: 'Nenhum huérfão com cns encontrado' });
    }

    // 2. Indexar pacientes novos por cns
    var pacPage = 1;
    var pacByCns = {};
    while (true) {
      var pacRows = db.newQuery(
        'SELECT id, cns FROM ' + PAC + ' WHERE cns IS NOT NULL AND cns != "" ' +
        'LIMIT 500 OFFSET ' + ((pacPage - 1) * 500)
      ).all();
      if (pacRows.length === 0) break;
      for (var i = 0; i < pacRows.length; i++) {
        var cns = String(pacRows[i].get('cns'));
        var id = pacRows[i].get('id');
        pacByCns[cns] = id;
      }
      if (pacRows.length < 500) break;
      pacPage++;
    }

    // 3. Re-vincular cada huérfão
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
          'UPDATE ' + ACOMP + ' SET paciente = "' + newPacId + '" WHERE id = "' + orphId + '"'
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
