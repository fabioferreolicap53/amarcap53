// unique_user.pb.js
// Enforce unique combination of role + unidade + equipe + microarea
// Goja engine (ES5) — funções inline no callback para evitar ReferenceError

// ─── CREATE — check duplicate combo ───────────────────
onRecordCreate(function(e) {
  try {
    var rec = e.record;
    var role = '';
    var unidade = '';
    var equipe = '';
    var microarea = '';
    try { var v = rec.get('role'); if (v !== undefined && v !== null && v !== '') role = String(v); } catch(_) {}
    try { var v = rec.get('unidade_saude'); if (v !== undefined && v !== null && v !== '') unidade = String(v); } catch(_) {}
    try { var v = rec.get('equipe'); if (v !== undefined && v !== null && v !== '') equipe = String(v); } catch(_) {}
    try { var v = rec.get('microarea'); if (v !== undefined && v !== null && v !== '') microarea = String(v); } catch(_) {}
    var esc = function(s) { return String(s || '').replace(/"/g, '\\"'); };
    var filter = '';
    if (role === 'cap') filter = 'role = "cap"';
    else if (role === 'unidade') filter = 'role = "unidade" && unidade_saude = "' + esc(unidade) + '"';
    else if (role === 'equipe') filter = 'role = "equipe" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '"';
    else if (role === 'microarea') {
      var m = String(microarea).trim();
      if (m && m !== '0' && m !== 'N/A') filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "' + esc(m) + '" || microarea = ' + parseInt(m, 10) + ')';
      else filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "" || microarea = null || microarea = "N/A")';
    }
    if (filter) {
      var rows = $app.findRecordsByFilter('amarcap53_users', filter, '-created', 1, 0);
      if (rows && rows.length > 0) {
        throw new Error('Ja existe um cadastro com esta combinacao de perfil e localizacao.');
      }
    }
  } catch (err) {
    if (err && err.message && err.message.indexOf('Ja existe') === 0) throw err;
    console.error('[unique_user] CREATE hook error (ignoring): ' + String(err));
  }
  e.next();
}, "amarcap53_users");

// ─── UPDATE — check duplicate combo ───────────────────
onRecordUpdate(function(e) {
  try {
    var rec = e.record;
    var role = '';
    var unidade = '';
    var equipe = '';
    var microarea = '';
    try { var v = rec.get('role'); if (v !== undefined && v !== null && v !== '') role = String(v); } catch(_) {}
    try { var v = rec.get('unidade_saude'); if (v !== undefined && v !== null && v !== '') unidade = String(v); } catch(_) {}
    try { var v = rec.get('equipe'); if (v !== undefined && v !== null && v !== '') equipe = String(v); } catch(_) {}
    try { var v = rec.get('microarea'); if (v !== undefined && v !== null && v !== '') microarea = String(v); } catch(_) {}
    var esc = function(s) { return String(s || '').replace(/"/g, '\\"'); };
    var filter = '';
    if (role === 'cap') filter = 'role = "cap"';
    else if (role === 'unidade') filter = 'role = "unidade" && unidade_saude = "' + esc(unidade) + '"';
    else if (role === 'equipe') filter = 'role = "equipe" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '"';
    else if (role === 'microarea') {
      var m = String(microarea).trim();
      if (m && m !== '0' && m !== 'N/A') filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "' + esc(m) + '" || microarea = ' + parseInt(m, 10) + ')';
      else filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "" || microarea = null || microarea = "N/A")';
    }
    if (filter) {
      var selfId = rec.id;
      var rows = $app.findRecordsByFilter('amarcap53_users', filter, '-created', 10, 0);
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].id !== selfId) {
          throw new Error('Ja existe um cadastro com esta combinacao de perfil e localizacao.');
        }
      }
    }
  } catch (err) {
    if (err && err.message && err.message.indexOf('Ja existe') === 0) throw err;
    console.error('[unique_user] UPDATE hook error (ignoring): ' + String(err));
  }
  e.next();
}, "amarcap53_users");

// ─── AUTH — block unverified users ────────────────────
onRecordAuthRequest(function(e) {
  var record = e.record;
  if (!record) { e.next(); return; }

  var verified = record.get('verified');
  if (verified === false || verified === 0 || verified === 'false' || verified === null || verified === undefined) {
    throw new Error('E-mail nao confirmado. Verifique sua caixa de entrada e confirme o link antes de fazer login.');
  }

  e.next();
}, "amarcap53_users");
