// unique_user.pb.js
// Enforce unique combination of role + unidade + equipe + microarea
// PocketBase JS API: onRecordCreate / onRecordUpdate / onRecordAuthRequest
// Goja engine (ES5) — no modern JS features

function esc(v) {
  return String(v || '').replace(/"/g, '\\"');
}

function getField(record, name) {
  try {
    var val = record.get(name);
    if (val !== undefined && val !== null && val !== '') return String(val);
  } catch (_) {}
  return '';
}

function buildFilter(record) {
  var role = getField(record, 'role');
  var unidade = getField(record, 'unidade_saude');
  var equipe = getField(record, 'equipe');
  var microarea = getField(record, 'microarea');

  console.log('[unique_user] buildFilter role=' + role + ' unidade=' + unidade + ' equipe=' + equipe + ' microarea=' + microarea);

  if (role === 'cap') return 'role = "cap"';
  if (role === 'unidade') return 'role = "unidade" && unidade_saude = "' + esc(unidade) + '"';
  if (role === 'equipe') return 'role = "equipe" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '"';
  if (role === 'microarea') {
    var m = String(microarea).trim();
    if (m && m !== '0' && m !== 'N/A') {
      return 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "' + esc(m) + '" || microarea = ' + parseInt(m, 10) + ')';
    }
    return 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "" || microarea = null || microarea = "N/A")';
  }
  return '';
}

function hasDuplicate(dao, filter) {
  if (!filter) return false;
  try {
    console.log('[unique_user] hasDuplicate filter=' + filter);
    var rows = dao.findRecordsByFilter('amarcap53_users', filter, '-created', 1, 0);
    var found = rows && rows.length > 0;
    console.log('[unique_user] hasDuplicate found=' + found + ' count=' + (rows ? rows.length : 0));
    return found;
  } catch (e) {
    // fail-open: log error but don't block registration
    console.error('[unique_user] hasDuplicate ERRO (fail-open): ' + String(e));
    return false;
  }
}

// ─── CREATE — check duplicate combo ───────────────────
onRecordCreate(function(e) {
  console.log('[unique_user] CREATE hook triggered');
  var dao = $app.dao();
  if (!dao) { console.log('[unique_user] DAO null, skip'); e.next(); return; }

  var filter = buildFilter(e.record);
  if (hasDuplicate(dao, filter)) {
    console.log('[unique_user] CREATE BLOQUEADO');
    throw new Error('Ja existe um cadastro com esta combinacao de perfil e localizacao.');
  }

  console.log('[unique_user] CREATE OK, proceeding');
  e.next();
}, "amarcap53_users");

// ─── UPDATE — check duplicate combo ───────────────────
onRecordUpdate(function(e) {
  var dao = $app.dao();
  if (!dao) { e.next(); return; }

  var filter = buildFilter(e.record);
  if (!filter) { e.next(); return; }

  try {
    var rows = dao.findRecordsByFilter('amarcap53_users', filter, '-created', 10, 0);
    var selfId = e.record.id;
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id !== selfId) {
        throw new Error('Ja existe um cadastro com esta combinacao de perfil e localizacao.');
      }
    }
  } catch (err) {
    if (err && err.status === 400) throw err;
    // fail-open on unexpected errors
    console.error('[unique_user] UPDATE ERRO (fail-open): ' + String(err));
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
