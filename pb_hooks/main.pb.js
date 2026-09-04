// pb_hooks/main.pb.js
// Consolidação de todos os hooks do sistema AMAR

// ─── CONFIGURAÇÕES GERAIS ───────────────────────────────
var PACIENTES_COLL = 'amarcap53_pacientes';
var ACOMP_COLL = 'amarcap53_acompanhamentos';
var USERS_COLL = 'amarcap53_users';
var LOG_COLL = 'amarcap53_importacoes';

// ─── HELPERS ────────────────────────────────────────────
function padLeft(str, len, ch) {
  var s = String(str);
  ch = ch || ' ';
  while (s.length < len) s = ch + s;
  return s;
}

function escSql(v) {
  if (v === null || v === undefined || v === '') return 'NULL';
  var s = String(v).replace(/'/g, "''");
  return "'" + s + "'";
}

// ─── HOOKS: USUÁRIOS ÚNICOS ─────────────────────────────
onRecordCreate(function(e) {
  try {
    var rec = e.record;
    var role = String(rec.get('role') || '');
    var unidade = String(rec.get('unidade_saude') || '');
    var equipe = String(rec.get('equipe') || '');
    var microarea = String(rec.get('microarea') || '');
    
    var esc = function(s) { return String(s || '').replace(/"/g, '\\"'); };
    var filter = '';
    
    if (role === 'cap') filter = 'role = "cap"';
    else if (role === 'unidade') filter = 'role = "unidade" && unidade_saude = "' + esc(unidade) + '"';
    else if (role === 'equipe') filter = 'role = "equipe" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '"';
    else if (role === 'microarea') {
      var m = microarea.trim();
      if (m && m !== '0' && m !== 'N/A') filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "' + esc(m) + '" || microarea = ' + parseInt(m, 10) + ')';
      else filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "" || microarea = null || microarea = "N/A")';
    }
    
    if (filter) {
      var rows = $app.findRecordsByFilter(USERS_COLL, filter, '-created', 1, 0);
      if (rows && rows.length > 0) throw new Error('Ja existe um cadastro com esta combinacao.');
    }
  } catch (err) {
    if (err && err.message && err.message.indexOf('Ja existe') === 0) throw err;
    console.error('[unique_user] Create error:', err);
  }
  e.next();
}, USERS_COLL);

onRecordUpdate(function(e) {
  try {
    var rec = e.record;
    var role = String(rec.get('role') || '');
    var unidade = String(rec.get('unidade_saude') || '');
    var equipe = String(rec.get('equipe') || '');
    var microarea = String(rec.get('microarea') || '');
    
    var esc = function(s) { return String(s || '').replace(/"/g, '\\"'); };
    var filter = '';
    
    if (role === 'cap') filter = 'role = "cap"';
    else if (role === 'unidade') filter = 'role = "unidade" && unidade_saude = "' + esc(unidade) + '"';
    else if (role === 'equipe') filter = 'role = "equipe" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '"';
    else if (role === 'microarea') {
      var m = microarea.trim();
      if (m && m !== '0' && m !== 'N/A') filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "' + esc(m) + '" || microarea = ' + parseInt(m, 10) + ')';
      else filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "" || microarea = null || microarea = "N/A")';
    }
    
    if (filter) {
      var selfId = rec.id;
      var rows = $app.findRecordsByFilter(USERS_COLL, filter, '-created', 10, 0);
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].id !== selfId) throw new Error('Ja existe um cadastro com esta combinacao.');
      }
    }
  } catch (err) {
    if (err && err.message && err.message.indexOf('Ja existe') === 0) throw err;
    console.error('[unique_user] Update error:', err);
  }
  e.next();
}, USERS_COLL);

onRecordAuthRequest(function(e) {
  var rec = e.record;
  if (rec && !rec.get('verified')) {
    throw new Error('E-mail nao confirmado. Verifique sua caixa de entrada.');
  }
  e.next();
}, USERS_COLL);

// ─── HOOKS: NORMALIZAÇÃO DE UNIDADE ──────────────────────
onBootstrap(function(e) {
  try {
    var db = $app.db();
    db.newQuery("UPDATE " + PACIENTES_COLL + " SET unidade = trim(unidade) WHERE unidade != trim(unidade)").execute();
    db.newQuery("UPDATE " + PACIENTES_COLL + " SET unidade = REPLACE(unidade, '  ', ' ') WHERE unidade LIKE '%  %'").execute();
  } catch (err) {}
  e.next();
});

onRecordCreate(function(e) {
  var u = e.record.get('unidade');
  if (u && typeof u === 'string') e.record.set('unidade', u.trim().replace(/\s+/g, ' '));
  e.next();
}, PACIENTES_COLL);

onRecordUpdate(function(e) {
  var u = e.record.get('unidade');
  if (u && typeof u === 'string') e.record.set('unidade', u.trim().replace(/\s+/g, ' '));
  e.next();
}, PACIENTES_COLL);

// ─── HOOKS: ACOMPANHAMENTOS (Auto-CNS & Sync) ───────────
onRecordCreate(function(e) {
  try {
    var rec = e.record;
    var pacId = rec.get('paciente');
    var currentCns = rec.get('cns');
    
    // Se já tem CNS (enviado pelo frontend), não faz nada
    if (currentCns && String(currentCns).trim() !== '') {
      e.next();
      return;
    }

    if (pacId) {
      var pac = $app.findRecordById(PACIENTES_COLL, pacId);
      if (pac) {
        var cns = pac.get('cns');
        if (cns) rec.set('cns', cns);
      }
    }
  } catch (err) {
    console.error('[acompanhamento_cns] Hook error:', err);
  }
  e.next();
}, ACOMP_COLL);

// Sincronizar CNS antes de qualquer deleção de paciente
onRecordBeforeDeleteRequest(function(e) {
  try {
    var db = $app.db();
    var pacId = e.record.id;
    var cns = e.record.get('cns');
    if (pacId && cns) {
      db.newQuery(
        "UPDATE amarcap53_acompanhamentos SET cns = '" + cns + "' " +
        "WHERE paciente = '" + pacId + "' AND (cns = '' OR cns IS NULL)"
      ).execute();
    }
  } catch(err) {
    console.error('[paciente_delete] Sync CNS error:', err);
  }
  e.next();
}, PACIENTES_COLL);

// ─── ROTAS CUSTOMIZADAS ─────────────────────────────────

// 1. Sincronizar CNS nos acompanhamentos (POST)
routerAdd('POST', '/api/custom/migrate-acompanhamento-cns', function(c) {
  try {
    var db = $app.db();
    db.newQuery(
      "UPDATE amarcap53_acompanhamentos " +
      "SET cns = (SELECT cns FROM amarcap53_pacientes WHERE id = amarcap53_acompanhamentos.paciente) " +
      "WHERE (cns = '' OR cns IS NULL) " +
      "AND paciente IN (SELECT id FROM amarcap53_pacientes)"
    ).execute();
    return c.json(200, { success: true });
  } catch(err) {
    return c.json(500, { message: String(err) });
  }
});

// 2. Re-vincular acompanhamentos por CNS (POST)
routerAdd('POST', '/api/custom/fix-relink-cns', function(c) {
  var result = { ok: false, relinked: 0, scanned: 0, details: [], err: '' };
  try {
    var db = $app.db();
    
    // Mapear pacientes atuais: CNS -> ID
    var pacMap = {};
    var pacRows = db.newQuery("SELECT id, cns FROM amarcap53_pacientes WHERE cns != '' AND cns IS NOT NULL").all();
    for (var i = 0; i < pacRows.length; i++) {
      var row = pacRows[i];
      var cns = String(row.cns || (row.get ? row.get('cns') : '') || '').replace(/\D/g, '').trim();
      var id = String(row.id || (row.get ? row.get('id') : '') || '').trim();
      if (cns && id) pacMap[cns] = id;
    }
    
    // Buscar acompanhamentos sem vínculo válido que tenham CNS
    var acompRows = db.newQuery(
      "SELECT id, cns, paciente FROM amarcap53_acompanhamentos " +
      "WHERE cns != '' AND cns IS NOT NULL"
    ).all();

    result.scanned = acompRows.length;

    for (var j = 0; j < acompRows.length; j++) {
      var aRow = acompRows[j];
      var aId = String(aRow.id || (aRow.get ? aRow.get('id') : '') || '');
      var aCns = String(aRow.cns || (aRow.get ? aRow.get('cns') : '') || '').replace(/\D/g, '').trim();
      var currentPac = String(aRow.paciente || (aRow.get ? aRow.get('paciente') : '') || '');
      
      // Verifica se o vínculo atual é inválido
      var isInvalid = !currentPac;
      if (currentPac) {
        try {
          var exists = db.newQuery("SELECT 1 FROM amarcap53_pacientes WHERE id = '" + currentPac + "'").all();
          if (!exists || exists.length === 0) isInvalid = true;
        } catch(e) { isInvalid = true; }
      }

      if (isInvalid) {
        var newPacId = pacMap[aCns];
        if (aId && newPacId) {
          db.newQuery("UPDATE amarcap53_acompanhamentos SET paciente = '" + newPacId + "' WHERE id = '" + aId + "'").execute();
          result.relinked++;
        }
      }
    }
    
    result.ok = true;
    return c.json(200, result);
  } catch(err) {
    result.err = String(err);
    return c.json(500, result);
  }
});

// 3. Importar pacientes (Corrigido com ID e Timestamps)
routerAdd('POST', '/api/custom/import-pacientes', function(c) {
  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { message: 'Nao autenticado' });
    
    var body = {};
    try { body = c.parseBody() || {}; } catch(e) {}
    
    var records = body.records || [];
    var mode = body.mode || 'replace';
    var db = $app.db();
    
    if (mode === 'replace') {
      // Backup CNS
      try {
        db.newQuery(
          "UPDATE amarcap53_acompanhamentos " +
          "SET cns = (SELECT cns FROM amarcap53_pacientes WHERE id = amarcap53_acompanhamentos.paciente) " +
          "WHERE (cns = '' OR cns IS NULL) " +
          "AND paciente IN (SELECT id FROM amarcap53_pacientes)"
        ).execute();
      } catch(e) {}
      db.newQuery("DELETE FROM " + PACIENTES_COLL).execute();
    }
    
    var imported = 0;
    var now = new Date().toISOString().replace('T', ' ').split('.')[0];
    
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      try {
        var cns = padLeft(String(r.cns || '').replace(/\D/g, ''), 15, '0').slice(-15);
        if (!cns || !r.nome) continue;
        
        // Gerar ID aleatório de 15 caracteres (padrão PocketBase)
        var id = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 9);
        id = id.substring(0, 15);
        
        db.newQuery("INSERT INTO " + PACIENTES_COLL + " (id, created, updated, unidade, equipe, microarea, cns, nome, data_nascimento, idade, grupo) VALUES (" +
          escSql(id) + ", " + escSql(now) + ", " + escSql(now) + ", " +
          escSql(r.unidade) + ", " + escSql(r.equipe) + ", " + (parseInt(r.microarea, 10) || 0) + ", " +
          escSql(cns) + ", " + escSql(r.nome) + ", " + escSql(r.data_nascimento) + ", " +
          (parseInt(r.idade, 10) || 0) + ", " + escSql(r.grupo) + ")").execute();
        imported++;
      } catch(e) {}
    }
    
    return c.json(200, { success: true, imported: imported });
  } catch(err) {
    return c.json(500, { message: String(err) });
  }
});

// 3. Delete All
routerAdd('POST', '/api/custom/delete-all', function(c) {
  try {
    var coll = '';
    try { coll = c.parseBody().collection; } catch(e) {}
    if (!coll) return c.json(400, { message: 'Envie collection' });

    var db = $app.db();
    
    // Se for excluir pacientes, sincroniza CNS nos acompanhamentos primeiro
    if (coll === PACIENTES_COLL) {
      try {
        // SQLite: Update com Join simplificado
        db.newQuery(
          "UPDATE amarcap53_acompanhamentos " +
          "SET cns = (SELECT cns FROM amarcap53_pacientes WHERE id = amarcap53_acompanhamentos.paciente) " +
          "WHERE (cns = '' OR cns IS NULL) " +
          "AND paciente IN (SELECT id FROM amarcap53_pacientes)"
        ).execute();
      } catch(e) { console.error('[delete-all] Sync CNS error:', e); }
    }

    db.newQuery("DELETE FROM " + coll).execute();
    return c.json(200, { success: true });
  } catch(err) {
    return c.json(500, { message: String(err) });
  }
});
