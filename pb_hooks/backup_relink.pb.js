// backup_relink.pb.js
// Salva backup do mapeamento paciente→acompanhamentos ANTES da exclusão
// e re-vincula DEPOIS da importação usando o backup
// Goja engine (ES5) — tudo inline

// ─── POST /api/custom/backup-patient-links ──────────────
// Salva snapshot de quais pacientes têm acompanhamentos vinculados
// Body: { action: "save" | "restore" }
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

    var db = getDb();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    var BACKUP_TABLE = '_patient_link_backup';

    // Criar tabela temporária se não existir
    try {
      db.newQuery(
        'CREATE TABLE IF NOT EXISTS ' + BACKUP_TABLE + ' (' +
        'id TEXT PRIMARY KEY, ' +
        'old_paciente_id TEXT, ' +
        'cns TEXT, ' +
        'acompanhamento_ids TEXT, ' +
        'created_at TEXT' +
        ')'
      ).execute();
    } catch(_) {}

    if (body.action === 'save') {
      // Salvar snapshot: para cada paciente que tem acompanhamentos,
      // salvar seu ID, CNS, e lista de IDs de acompanhamentos
      var pacWithAcomps = db.newQuery(
        'SELECT p.id as pac_id, p.cns as pac_cns, a.id as acomp_id ' +
        'FROM amarcap53_pacientes p ' +
        'INNER JOIN amarcap53_acompanhamentos a ON a.paciente = p.id'
      ).all();

      // Agrupar por paciente
      var pacMap = {};
      for (var i = 0; i < pacWithAcomps.length; i++) {
        var row = pacWithAcomps[i];
        var pacId = row.get('pac_id');
        var pacCns = row.get('pac_cns') || '';
        var acompId = row.get('acomp_id');
        if (!pacMap[pacId]) pacMap[pacId] = { cns: pacCns, acompIds: [] };
        pacMap[pacId].acompIds.push(acompId);
      }

      // Limpar backup anterior
      try { db.newQuery('DELETE FROM ' + BACKUP_TABLE).execute(); } catch(_) {}

      // Salvar
      var saved = 0;
      for (var pid in pacMap) {
        try {
          var ids = pacMap[pid].acompIds.join(',');
          var now = new Date().toISOString();
          db.newQuery(
            'INSERT INTO ' + BACKUP_TABLE + ' (id, old_paciente_id, cns, acompanhamento_ids, created_at) VALUES (' +
            '"' + pid + '", "' + pid + '", "' + (pacMap[pid].cns || '') + '", "' + ids + '", "' + now + '"'
          ).execute();
          saved++;
        } catch(_) {}
      }

      return c.json(200, { success: true, action: 'save', saved: saved, totalLinks: pacWithAcomps.length });

    } else if (body.action === 'restore') {
      // Restaurar: ler backup, para cada registro, buscar paciente novo pelo CNS,
      // e atualizar os acompanhamentos para apontar para o novo paciente
      var backups = db.newQuery('SELECT * FROM ' + BACKUP_TABLE).all();
      if (backups.length === 0) {
        return c.json(200, { success: true, action: 'restore', message: 'Nenhum backup encontrado', relinked: 0 });
      }

      var relinked = 0;
      var failed = 0;

      for (var bi = 0; bi < backups.length; bi++) {
        var bk = backups[bi];
        var oldPacId = bk.get('old_paciente_id') || '';
        var pacCns = bk.get('cns') || '';
        var acompIdsStr = bk.get('acompanhamento_ids') || '';

        if (!pacCns || !acompIdsStr) { failed++; continue; }

        var acompIds = acompIdsStr.split(',');

        // Buscar paciente novo pelo CNS
        var newPacRows = db.newQuery(
          'SELECT id FROM amarcap53_pacientes WHERE cns = "' + pacCns + '" LIMIT 1'
        ).all();

        if (newPacRows.length === 0) { failed += acompIds.length; continue; }

        var newPacId = newPacRows[0].get('id');

        // Atualizar cada acompanhamento
        for (var ai = 0; ai < acompIds.length; ai++) {
          var acompId = acompIds[ai].trim();
          if (!acompId) continue;

          // Verificar se o acompanhamento existe e se o paciente já está correto
          var checkRows = db.newQuery(
            'SELECT id, paciente FROM amarcap53_acompanhamentos WHERE id = "' + acompId + '"'
          ).all();

          if (checkRows.length === 0) continue; // Acompanhamento não existe mais

          var currentPac = checkRows[0].get('paciente') || '';
          if (currentPac === newPacId) continue; // Já vinculado

          // Atualizar
          db.newQuery(
            'UPDATE amarcap53_acompanhamentos SET paciente = "' + newPacId + '" WHERE id = "' + acompId + '"'
          ).execute();
          relinked++;
        }
      }

      // Limpar backup após restore
      try { db.newQuery('DELETE FROM ' + BACKUP_TABLE).execute(); } catch(_) {}

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
