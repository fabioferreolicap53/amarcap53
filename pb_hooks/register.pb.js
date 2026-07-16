// register.pb.js
// POST /api/custom/register — cadastro com validação server-side de unicidade
// Bypassa hooks: toda validação acontece aqui via DAO (fail-closed)

function esc(v) {
  return String(v || '').replace(/"/g, '\\"');
}

function getDao() {
  try { return $app.dao(); } catch(e) { return null; }
}

function checkEmailDuplicate(dao, email) {
  try {
    var existing = dao.findRecordsByFilter(
      'amarcap53_users',
      'email = "' + esc(email) + '"',
      '-created',
      1,
      0
    );
    return existing && existing.length > 0;
  } catch (e) {
    // Fail-closed: se filtro falhar, assume duplicata
    console.error('[register] Erro ao verificar email:', e);
    return true;
  }
}

function checkComboDuplicate(dao, role, unidade, equipe, microarea) {
  var filter = '';
  if (role === 'cap') {
    filter = 'role = "cap"';
  } else if (role === 'unidade') {
    filter = 'role = "unidade" && unidade_saude = "' + esc(unidade) + '"';
  } else if (role === 'equipe') {
    filter = 'role = "equipe" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '"';
  } else if (role === 'microarea') {
    filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && microarea = "' + esc(microarea) + '"';
  }
  if (!filter) return { found: false, msg: '' };

  try {
    var existing = dao.findRecordsByFilter('amarcap53_users', filter, '-created', 1, 0);
    if (existing && existing.length > 0) {
      var msg = 'Já existe um cadastro com esta combinação.';
      if (role === 'cap') msg = 'Já existe um usuário cadastrado para a Coordenação (CAP).';
      else if (role === 'unidade') msg = 'Já existe um gestor cadastrado para a unidade "' + unidade + '".';
      else if (role === 'equipe') msg = 'Já existe um enfermeiro/médico cadastrado para a equipe "' + equipe + '" da unidade "' + unidade + '".';
      else if (role === 'microarea') msg = 'Já existe um agente cadastrado para a microárea "' + microarea + '" da equipe "' + equipe + '" na unidade "' + unidade + '".';
      return { found: true, msg: msg };
    }
    return { found: false, msg: '' };
  } catch (e) {
    // Fail-closed
    console.error('[register] Erro ao verificar combinação:', e, 'Filtro:', filter);
    return { found: true, msg: 'Erro ao validar combinação. Tente novamente.' };
  }
}

// ─── POST /api/custom/register ──────────────────────────
routerAdd('POST', '/api/custom/register', function(c) {
  try {
    // Parse body
    var body;
    try {
      var info = c.requestInfo();
      if (info && info.body) {
        body = (typeof info.body === 'object') ? info.body : {};
        if (body && typeof body.get === 'function') {
          body = {
            email: body.get('email'),
            password: body.get('password'),
            passwordConfirm: body.get('passwordConfirm'),
            role: body.get('role'),
            unidade_saude: body.get('unidade_saude'),
            equipe: body.get('equipe'),
            microarea: body.get('microarea')
          };
        }
      } else { body = {}; }
    } catch (_) { body = {}; }

    // Extrair e normalizar campos
    var email = String(body.email || '').trim();
    var password = String(body.password || '');
    var passwordConfirm = String(body.passwordConfirm || '');
    var role = String(body.role || '').trim();
    var unidadeSaude = String(body.unidade_saude || '').trim();
    var equipe = String(body.equipe || '').trim();
    var microarea = String(body.microarea || '').trim();

    // ── Validações obrigatórias ──
    if (!email || !password || !role) {
      return c.json(400, { code: 400, message: 'Campos obrigatórios não preenchidos.' });
    }
    if (password !== passwordConfirm) {
      return c.json(400, { code: 400, message: 'As senhas não coincidem.' });
    }
    if (password.length < 8) {
      return c.json(400, { code: 400, message: 'A senha deve ter no mínimo 8 caracteres.' });
    }
    if (role !== 'cap' && role !== 'unidade' && role !== 'equipe' && role !== 'microarea') {
      return c.json(400, { code: 400, message: 'Perfil de acesso inválido.' });
    }
    if (role !== 'cap' && !unidadeSaude) {
      return c.json(400, { code: 400, message: 'Selecione a unidade de saúde.' });
    }
    if ((role === 'equipe' || role === 'microarea') && !equipe) {
      return c.json(400, { code: 400, message: 'Selecione a equipe.' });
    }
    if (role === 'microarea' && !microarea) {
      return c.json(400, { code: 400, message: 'Selecione a microárea.' });
    }

    // ── DAO ──
    var dao = getDao();
    if (!dao) return c.json(500, { code: 500, message: 'DAO indisponível.' });

    // ── Verificar email duplicado ──
    if (checkEmailDuplicate(dao, email)) {
      return c.json(400, { code: 400, message: 'Este e-mail já está sendo utilizado por outro usuário.' });
    }

    // ── Verificar combinação duplicada ──
    var combo = checkComboDuplicate(dao, role, unidadeSaude, equipe, microarea);
    if (combo.found) {
      return c.json(400, { code: 400, message: combo.msg });
    }

    // ── Criar usuário via DAO (com hash de senha) ──
    var collection = dao.findCollectionByNameOrId('amarcap53_users');
    if (!collection) return c.json(500, { code: 500, message: 'Coleção não encontrada.' });

    var record = new Record(collection);
    record.set('username', email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_') + Math.floor(Math.random() * 10000));
    record.set('email', email);
    record.set('emailVisibility', true);
    record.setPassword(password);
    record.set('unidade_saude', unidadeSaude);
    record.set('equipe', equipe);
    record.set('role', role);
    record.set('microarea', microarea);

    dao.saveRecord(record);

    return c.json(200, {
      code: 200,
      message: 'Cadastro realizado com sucesso!',
      record: { id: record.id, email: email }
    });

  } catch (err) {
    var errMsg = (err && err.message) ? err.message : 'Erro inesperado.';
    // Catch unique constraint errors do SQLite
    if (errMsg.indexOf('unique') !== -1 || errMsg.indexOf('Unique') !== -1 || errMsg.indexOf('UNIQUE') !== -1) {
      return c.json(400, { code: 400, message: 'Já existe um cadastro com esta combinação de perfil e localização.' });
    }
    console.error('[register] CRASH:', errMsg);
    return c.json(500, { code: 500, message: 'Erro ao criar conta. Verifique os dados.' });
  }
});
