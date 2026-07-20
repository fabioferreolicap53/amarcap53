// unique_user.pb.js
// Enforce unique combination of role + unidade + equipe + microarea on user create/update

// Escapa valores para uso seguro em filtros PocketBase
function esc(v) {
  return String(v || '').replace(/"/g, '\\"');
}

// Lê dados do request body como fallback
function getRequestBody(e) {
  try {
    var info = e.httpContext.requestInfo();
    return info && info.body ? info.body : {};
  } catch (err) {
    console.error('[unique_user] Erro ao ler request body:', err);
    return {};
  }
}

// Lê campo do record com fallback para request body
function getFieldValue(record, body, field) {
  // Tenta record.get primeiro
  try {
    var val = record.get(field);
    if (val !== undefined && val !== null && val !== '') return val;
  } catch (err) {
    // ignora
  }
  // Fallback: request body
  if (body && body[field] !== undefined && body[field] !== null) {
    return body[field];
  }
  return '';
}

function buildUniqueFilter(record, body) {
  var role = getFieldValue(record, body, 'role') || '';
  var unidade = getFieldValue(record, body, 'unidade_saude') || '';
  var equipe = getFieldValue(record, body, 'equipe') || '';
  var microarea = getFieldValue(record, body, 'microarea') || '';

  console.log('[unique_user] buildUniqueFilter:', { role: role, unidade: unidade, equipe: equipe, microarea: microarea });

  if (role === 'cap') {
    return 'role = "cap"';
  } else if (role === 'unidade') {
    return 'role = "unidade" && unidade_saude = "' + esc(unidade) + '"';
  } else if (role === 'equipe') {
    return 'role = "equipe" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '"';
  } else if (role === 'microarea') {
    // microarea pode ser string "1"-"7", number, ou null
    var mVal = String(microarea).trim();
    if (mVal && mVal !== '0' && mVal !== 'N/A') {
      return 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "' + esc(mVal) + '" || microarea = ' + parseInt(mVal, 10) + ')';
    }
    // microarea vazia: casa com vazio, null ou N/A
    return 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && (microarea = "" || microarea = null || microarea = "N/A")';
  }
  return '';
}

function checkDuplicate(dao, filter) {
  if (!filter) {
    console.log('[unique_user] Filtro vazio, ignorando verificação');
    return false;
  }
  try {
    console.log('[unique_user] Executando filtro:', filter);
    var existing = dao.findRecordsByFilter(
      'amarcap53_users',
      filter,
      '-created',
      1,
      0
    );
    console.log('[unique_user] Resultado:', existing ? existing.length : 0, 'registros encontrados');
    return existing && existing.length > 0;
  } catch (e) {
    // Se o filtro falhar por qualquer motivo, assume duplicata (fail-closed)
    console.error('[unique_user] ERRO ao verificar duplicata:', e, 'Filtro:', filter);
    return true;
  }
}

onRecordBeforeCreateRequest(function(e) {
  if (e.collection.name !== 'amarcap53_users') return;

  var dao = $app.dao();
  if (!dao) {
    console.error('[unique_user] DAO não disponível');
    return;
  }

  var body = getRequestBody(e);
  var filter = buildUniqueFilter(e.record, body);

  if (checkDuplicate(dao, filter)) {
    console.error('[unique_user] BLOQUEANDO criação - duplicata detectada');
    throw new Error(400, 'Já existe um cadastro com esta combinação de perfil e localização.');
  }

  console.log('[unique_user] Criação permitida - nenhuma duplicata');
});

onRecordBeforeUpdateRequest(function(e) {
  if (e.collection.name !== 'amarcap53_users') return;

  var dao = $app.dao();
  if (!dao) {
    console.error('[unique_user] DAO não disponível no update');
    return;
  }

  var body = getRequestBody(e);
  var filter = buildUniqueFilter(e.record, body);

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
      console.error('[unique_user] BLOQUEANDO update - duplicata detectada');
      throw new Error(400, 'Já existe um cadastro com esta combinação de perfil e localização.');
    }
  } catch (err) {
    if (err && err.status === 400) throw err; // Re-throw our own validation error
    // Se o filtro falhar por outro motivo, bloqueia (fail-closed)
    console.error('[unique_user] Erro ao verificar duplicata no update:', err);
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
