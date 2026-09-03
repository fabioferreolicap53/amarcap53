// backup_relink.pb.js
// Salva backup e restaura mapeamento paciente→acompanhamentos
// Goja engine (ES5) — standalone, sem dependências de outros hooks

function getDb2() { try { return $app.db(); } catch(e) { return null; } }

routerAdd('POST', '/api/custom/backup-patient-links', function(c) {
  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { code: 401, message: 'Nao autenticado' });
    var role = auth.get('role');
    if (role !== 'cap' && role !== 'admin') return c.json(403, { code: 403, message: 'Apenas CAP ou admin' });

    var body = {};
    try { body = c.parseBody() || {}; } catch(_) {}
    if (!body.action) {
      try {
        var info = c.requestInfo();
        if (info && info.body && typeof info.body === 'object') {
          var ib = info.body;
          body.action = (typeof ib.get === 'function') ? ib.get('action') : ib.action;
        }
      } catch(_) {}
    }

    var db = getDb2();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    if (body.action === 'save') {
      // 1. Buscar pacientes que têm acompanhamentos vinculados
      var links = db.newQuery(
        'SELECT DISTINCT a.paciente as pac_id FROM amarcap53_acompanhamentos a ' +
        'WHERE a.paciente IS NOT NULL AND a.paciente != "" AND a.paciente != "N/A"'
      ).all();

      if (links.length === 0) {
        return c.json(200, { success: true, action: 'save', saved: 0, message: 'Nenhum vinculo para salvar' });
      }

      // 2. Para cada paciente, buscar CNS e IDs dos acompanhamentos
      var saved = 0;
      var totalLinks = 0;
      var backupData = [];

      for (var i = 0; i < links.length; i++) {
        var pacId = links[i].get('pac_id');
        if (!pacId) continue;

        // Buscar CNS do paciente
        var pacRows = db.newQuery('SELECT cns FROM amarcap53_pacientes WHERE id = "' + pacId + '"').all();
        var pacCns = (pacRows.length > 0 && pacRows[0].get('cns')) ? String(pacRows[0].get('cns')) : '';
        if (!pacCns) continue;

        // Buscar IDs dos acompanhamentos deste paciente
        var acompRows = db.newQuery(
          'SELECT id FROM amarcap53_acompanhamentos WHERE paciente = "' + pacId + '"'
        ).all();
        if (acompRows.length === 0) continue;

        var acompIds = [];
        for (var j = 0; j < acompRows.length; j++) {
          acompIds.push(acompRows[j].get('id'));
        }

        backupData.push({ pacId: pacId, cns: pacCns, acompIds: acompIds });
        totalLinks += acompIds.length;
      }

      // 3. Salvar como JSON em arquivo temporário (via collection temporária ou string)
      // PocketBase não tem "collection temporária" fácil, então salvamos como
      // um registro único em uma coleção auxiliar ou como string no body
      // ABORDAGEM: salvar em variável global (funciona enquanto servidor não reinicia)
      try {
        global._patientBackup = backupData;
        saved = backupData.length;
      } catch(_) {}

      return c.json(200, { success: true, action: 'save', saved: saved, totalLinks: totalLinks });

    } else if (body.action === 'restore') {
      // Ler backup da memória global
      var backupData = [];
      try { backupData = global._patientBackup || []; } catch(_) {}

      if (backupData.length === 0) {
        return c.json(200, { success: true, action: 'restore', relinked: 0, message: 'Nenhum backup em memoria' });
      }

      var relinked = 0;
      var failed = 0;

      for (var bi = 0; bi < backupData.length; bi++) {
        var bk = backupData[bi];
        var oldPacId = bk.pacId;
        var pacCns = bk.cns;
        var acompIds = bk.acompIds;

        if (!pacCns || !acompIds || acompIds.length === 0) { failed++; continue; }

        // Buscar paciente novo pelo CNS
        var newPacRows = db.newQuery(
          'SELECT id FROM amarcap53_pacientes WHERE cns = "' + pacCns + '" LIMIT 1'
        ).all();

        if (newPacRows.length === 0) { failed += acompIds.length; continue; }

        var newPacId = newPacRows[0].get('id');
        if (newPacId === oldPacId) continue; // Mesmo paciente, nada a fazer

        // Atualizar cada acompanhamento
        for (var ai = 0; ai < acompIds.length; ai++) {
          var acompId = acompIds[ai];
          try {
            var curRows = db.newQuery(
              'SELECT paciente FROM amarcap53_acompanhamentos WHERE id = "' + acompId + '"'
            ).all();
            if (curRows.length === 0) continue;
            var curPac = curRows[0].get('paciente') || '';
            if (curPac === newPacId) continue;
            db.newQuery(
              'UPDATE amarcap53_acompanhamentos SET paciente = "' + newPacId + '" WHERE id = "' + acompId + '"'
            ).execute();
            relinked++;
          } catch(_) { failed++; }
        }
      }

      // Limpar backup
      try { global._patientBackup = []; } catch(_) {}

      return c.json(200, { success: true, action: 'restore', relinked: relinked, failed: failed });

    } else {
      return c.json(400, { message: 'action deve ser "save" ou "restore"' });
    }

  } catch(err) {
    var msg = (err && err.message) ? err.message : 'Erro';
    console.error('backup-patient-links CRASH:', msg);
    return c.json(500, { message: msg });
  }
});
