// unique_user.pb.js
// Enforce unique combination of role + unidade + equipe + microarea on user create/update

// Escapa valores para uso seguro em filtros PocketBase
function esc(v) {
  return String(v || '').replace(/"/g, '\\"');
}

function buildUniqueFilter(record) {
  var role = record.get('role') || '';
  var unidade = record.get('unidade_saude') || '';
  var equipe = record.get('equipe') || '';
  var microarea = record.get('microarea') || '';

  if (role === 'cap') {
    return 'role = "cap"';
  } else if (role === 'unidade') {
    return 'role = "unidade" && unidade_saude = "' + esc(unidade) + '"';
  } else if (role === 'equipe') {
    return 'role = "equipe" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '"';
  } else if (role === 'microarea') {
    return 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && microarea = "' + esc(microarea) + '"';
  }
  return '';
}

function checkDuplicate(dao, filter) {
  if (!filter) return false;
  try {
    var existing = dao.findRecordsByFilter(
      'amarcap53_users',
      filter,
      '-created',
      1,
      0
    );
    return existing && existing.length > 0;
  } catch (e) {
    // Se o filtro falhar por qualquer motivo, assume duplicata (fail-closed)
    console.error('[unique_user] Erro ao verificar duplicata:', e, 'Filtro:', filter);
    return true;
  }
}

onRecordBeforeCreateRequest(function(e) {
  if (e.collection.name !== 'amarcap53_users') return;

  var dao = $app.dao();
  if (!dao) return;

  var filter = buildUniqueFilter(e.record);

  if (checkDuplicate(dao, filter)) {
    throw new Error(400, 'Já existe um cadastro com esta combinação de perfil e localização.');
  }
});

onRecordBeforeUpdateRequest(function(e) {
  if (e.collection.name !== 'amarcap53_users') return;

  var dao = $app.dao();
  if (!dao) return;

  var filter = buildUniqueFilter(e.record);

  if (!filter) return;

  // Para updates, busca até 10 registros e exclui o próprio
  try {
    var existing = dao.findRecordsByFilter(
      'amarcap53_users',
      filter,
      '-created',
      10,
      0
    );

    var recordId = e.record.id;
    var duplicate = existing.filter(function(r) { return r.id !== recordId; });

    if (duplicate.length > 0) {
      throw new Error(400, 'Já existe um cadastro com esta combinação de perfil e localização.');
    }
  } catch (e) {
    if (e.status === 400) throw e; // Re-throw our own validation error
    // Se o filtro falhar por outro motivo, bloqueia (fail-closed)
    console.error('[unique_user] Erro ao verificar duplicata no update:', e);
    throw new Error(400, 'Erro ao validar combinação. Tente novamente.');
  }
});

// ─── Bloqueia login de usuários com e-mail não confirmado ───
onRecordBeforeAuthRequest(function(e) {
  if (e.collection.name !== 'amarcap53_users') return;

  var record = e.record;
  if (!record) return;

  var verified = record.get('verified');
  if (verified === false || verified === 0 || verified === 'false' || verified === null || verified === undefined) {
    throw new Error(403, 'E-mail não confirmado. Verifique sua caixa de entrada (e SPAM) e confirme o link antes de fazer login.');
  }
});
