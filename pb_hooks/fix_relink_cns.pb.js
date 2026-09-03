// fix_relink_cns.pb.js
// Re-vincula acompanhamentos a pacientes por CNS
// Corrige "Invalid variable type: must be a pointer"

routerAdd('GET', '/api/custom/fix-relink-cns', function(c) {
  var result = { ok: false, before: 0, after: 0, err: '' };

  try {
    var db = $app.db();
    if (!db) { result.err = 'no db'; return c.json(500, result); }

    // Helper seguro: converte resultado para número
    function safeCount(sql) {
      try {
        var rows = db.newQuery(sql).all();
        if (rows && rows.length > 0) {
          var val = rows[0].get('cnt');
          return parseInt(String(val), 10) || 0;
        }
      } catch(_) {}
      return 0;
    }

    // 1. Contar huérfãos antes
    result.before = safeCount(
      "SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos " +
      "WHERE (paciente IS NULL OR paciente = '') " +
      "OR NOT EXISTS (SELECT 1 FROM amarcap53_pacientes WHERE id = amarcap53_acompanhamentos.paciente)"
    );

    // 2. Fix: UPDATE direto — sem subquery complexa
    //    Para cada acompanhamento com cns, buscar paciente com mesmo cns
    try {
      // Buscar todos os pacientes e indexar por cns
      var pacMap = {};
      var pacRows = db.newQuery("SELECT id, cns FROM amarcap53_pacientes WHERE cns IS NOT NULL AND cns != ''").all();
      if (pacRows) {
        for (var i = 0; i < pacRows.length; i++) {
          var pCns = String(pacRows[i].get('cns') || '');
          var pId = String(pacRows[i].get('id') || '');
          if (pCns && pId) pacMap[pCns] = pId;
        }
      }

      // Buscar todos os acompanhamentos huérfãos com cns
      var orphRows = db.newQuery(
        "SELECT id, cns FROM amarcap53_acompanhamentos " +
        "WHERE cns IS NOT NULL AND cns != '' " +
        "AND (paciente IS NULL OR paciente = '' " +
        "OR NOT EXISTS (SELECT 1 FROM amarcap53_pacientes WHERE id = amarcap53_acompanhamentos.paciente))"
      ).all();

      if (orphRows) {
        for (var j = 0; j < orphRows.length; j++) {
          var oCns = String(orphRows[j].get('cns') || '');
          var oId = String(orphRows[j].get('id') || '');
          var newPacId = pacMap[oCns];
          if (!oId || !newPacId) continue;
          try {
            db.newQuery(
              "UPDATE amarcap53_acompanhamentos SET paciente = '" + newPacId + "' WHERE id = '" + oId + "'"
            ).execute();
          } catch(_) {}
        }
      }
    } catch(updErr) {
      result.err = 'update: ' + String(updErr);
    }

    // 3. Contar huérfãos depois
    result.after = safeCount(
      "SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos " +
      "WHERE (paciente IS NULL OR paciente = '') " +
      "OR NOT EXISTS (SELECT 1 FROM amarcap53_pacientes WHERE id = amarcap53_acompanhamentos.paciente)"
    );

    result.ok = true;
  } catch(err) {
    result.err = String(err);
  }

  return c.json(200, result);
});
