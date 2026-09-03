// relink_acompanhamentos.pb.js
// Lógica consolidada para re-vincular acompanhamentos a pacientes por CNS

// ─── GET /api/custom/fix-relink-cns ─────────────────────
// Re-vincula acompanhamentos huérfãos comparando o campo CNS
routerAdd('GET', '/api/custom/fix-relink-cns', function(c) {
  var result = { ok: false, before: 0, after: 0, relinked: 0, err: '' };

  try {
    var db = $app.db();
    if (!db) { result.err = 'DB indisponível'; return c.json(500, result); }

    var ACOMP = 'amarcap53_acompanhamentos';
    var PAC = 'amarcap53_pacientes';

    // Helper para contagem
    var getOrphanCount = function() {
      try {
        var rows = db.newQuery(
          "SELECT COUNT(*) as cnt FROM " + ACOMP + " a " +
          "WHERE (a.paciente IS NULL OR a.paciente = '') " +
          "OR NOT EXISTS (SELECT 1 FROM " + PAC + " p WHERE p.id = a.paciente)"
        ).all();
        return (rows && rows.length > 0) ? parseInt(String(rows[0].get('cnt')), 10) : 0;
      } catch(e) { return 0; }
    };

    result.before = getOrphanCount();

    // 1. Mapear pacientes atuais por CNS
    var pacMap = {};
    try {
      var pacRows = db.newQuery("SELECT id, cns FROM " + PAC + " WHERE cns IS NOT NULL AND cns != ''").all();
      if (pacRows) {
        for (var i = 0; i < pacRows.length; i++) {
          var p = pacRows[i];
          var cns = String(p.get('cns') || '');
          var id = String(p.get('id') || '');
          if (cns && id) pacMap[cns] = id;
        }
      }
    } catch(e) { result.err = 'Erro ao mapear pacientes: ' + String(e); }

    // 2. Buscar acompanhamentos huérfãos que tenham CNS
    try {
      var orphRows = db.newQuery(
        "SELECT id, cns FROM " + ACOMP + " a " +
        "WHERE (a.cns IS NOT NULL AND a.cns != '') " +
        "AND ((a.paciente IS NULL OR a.paciente = '') " +
        "OR NOT EXISTS (SELECT 1 FROM " + PAC + " p WHERE p.id = a.paciente))"
      ).all();

      if (orphRows) {
        for (var j = 0; j < orphRows.length; j++) {
          var o = orphRows[j];
          var oCns = String(o.get('cns') || '');
          var oId = String(o.get('id') || '');
          var newPacId = pacMap[oCns];
          
          if (oId && newPacId) {
            db.newQuery("UPDATE " + ACOMP + " SET paciente = '" + newPacId + "' WHERE id = '" + oId + "'").execute();
            result.relinked++;
          }
        }
      }
    } catch(e) { result.err = 'Erro no re-vincular: ' + String(e); }

    result.after = getOrphanCount();
    result.ok = true;
    return c.json(200, result);

  } catch(err) {
    result.err = String(err);
    return c.json(500, result);
  }
});

// ─── POST /api/custom/migrate-acompanhamento-cns ────────
// Popula o campo CNS nos acompanhamentos a partir do paciente atual (execução única)
routerAdd('POST', '/api/custom/migrate-acompanhamento-cns', function(c) {
  try {
    var db = $app.db();
    if (!db) return c.json(500, { success: false, message: 'DB indisponível' });

    db.newQuery(
      "UPDATE amarcap53_acompanhamentos SET cns = (" +
      "  SELECT p.cns FROM amarcap53_pacientes p WHERE p.id = amarcap53_acompanhamentos.paciente" +
      ") WHERE paciente IS NOT NULL AND paciente != '' AND (cns IS NULL OR cns = '') AND EXISTS (" +
      "  SELECT 1 FROM amarcap53_pacientes p WHERE p.id = amarcap53_acompanhamentos.paciente AND p.cns IS NOT NULL AND p.cns != ''" +
      ")"
    ).execute();

    return c.json(200, { success: true });
  } catch(err) {
    return c.json(500, { success: false, message: String(err) });
  }
});

// ─── GET /api/custom/diag-acompanhamentos ───────────────
routerAdd('GET', '/api/custom/diag-acompanhamentos', function(c) {
  try {
    var db = $app.db();
    if (!db) return c.json(500, { err: 'no db' });

    var q = function(sql) {
      var r = db.newQuery(sql).all();
      return (r && r.length > 0) ? r[0].get('cnt') : 0;
    };

    return c.json(200, {
      total_acompanhamentos: q("SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos"),
      com_cns: q("SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos WHERE cns != '' AND cns IS NOT NULL"),
      huertaos: q("SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos a WHERE (a.paciente IS NULL OR a.paciente = '') OR NOT EXISTS (SELECT 1 FROM amarcap53_pacientes WHERE id = a.paciente)"),
      total_pacientes: q("SELECT COUNT(*) as cnt FROM amarcap53_pacientes")
    });
  } catch(e) { return c.json(500, { err: String(e) }); }
});
