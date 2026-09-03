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

// ─── ROTAS CUSTOMIZADAS ─────────────────────────────────

// 1. Re-vincular acompanhamentos por CNS (GET)
routerAdd('GET', '/api/custom/fix-relink-cns', function(c) {
  var result = { ok: false, before: 0, after: 0, relinked: 0, err: '' };
  try {
    var db = $app.db();
    var getCount = function() {
      var r = db.newQuery("SELECT COUNT(*) as cnt FROM " + ACOMP_COLL + " a WHERE (a.paciente IS NULL OR a.paciente = '') OR NOT EXISTS (SELECT 1 FROM " + PACIENTES_COLL + " p WHERE p.id = a.paciente)").all();
      return (r && r.length > 0) ? parseInt(String(r[0].get('cnt')), 10) : 0;
    };
    result.before = getCount();
    
    var pacMap = {};
    var pacRows = db.newQuery("SELECT id, cns FROM " + PACIENTES_COLL + " WHERE cns != ''").all();
    if (pacRows) {
      for (var i = 0; i < pacRows.length; i++) {
        pacMap[String(pacRows[i].get('cns'))] = String(pacRows[i].get('id'));
      }
    }
    
    var orphRows = db.newQuery("SELECT id, cns FROM " + ACOMP_COLL + " WHERE cns != '' AND ((paciente IS NULL OR paciente = '') OR NOT EXISTS (SELECT 1 FROM " + PACIENTES_COLL + " p WHERE p.id = " + ACOMP_COLL + ".paciente))").all();
    if (orphRows) {
      for (var j = 0; j < orphRows.length; j++) {
        var newId = pacMap[String(orphRows[j].get('cns'))];
        if (newId) {
          db.newQuery("UPDATE " + ACOMP_COLL + " SET paciente = '" + newId + "' WHERE id = '" + String(orphRows[j].get('id')) + "'").execute();
          result.relinked++;
        }
      }
    }
    result.after = getCount();
    result.ok = true;
    return c.json(200, result);
  } catch(err) {
    result.err = String(err);
    return c.json(500, result);
  }
});

// 2. Importar pacientes (Simplificado - re-link feito no frontend/fix-endpoint)
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
      db.newQuery("DELETE FROM " + PACIENTES_COLL).execute();
    }
    
    var imported = 0;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      try {
        var cns = padLeft(String(r.cns || '').replace(/\D/g, ''), 15, '0').slice(-15);
        if (!cns || !r.nome) continue;
        
        db.newQuery("INSERT INTO " + PACIENTES_COLL + " (unidade, equipe, microarea, cns, nome, data_nascimento, idade, grupo) VALUES (" +
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
    $app.db().newQuery("DELETE FROM " + coll).execute();
    return c.json(200, { success: true });
  } catch(err) {
    return c.json(500, { message: String(err) });
  }
});
