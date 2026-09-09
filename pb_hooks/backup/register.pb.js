// register.pb.js
// POST /api/custom/register — cadastro com validação server-side
// Usa apenas APIs Goja confirmadas no import_pacientes.pb.js

function esc(v) {
  return String(v || '').replace(/"/g, '\\"');
}

function exists(dao, filter) {
  try {
    var result = dao.findRecordsByFilter('amarcap53_users', filter, '-created', 1, 0);
    return result && result.length > 0;
  } catch (e) {
    console.error('[register] filter error:', e.message, 'filter:', filter);
    return true;
  }
}

function comboFilter(role, unidade, equipe, microarea) {
  if (role === 'cap') return 'role = "cap"';
  if (role === 'unidade') return 'role = "unidade" && unidade_saude = "' + esc(unidade) + '"';
  if (role === 'equipe') return 'role = "equipe" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '"';
  if (role === 'microarea') return 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && equipe = "' + esc(equipe) + '" && microarea = "' + esc(microarea) + '"';
  return '';
}

function comboMsg(role, unidade, equipe, microarea) {
  if (role === 'cap') return 'Já existe um usuário cadastrado para a Coordenação (CAP).';
  if (role === 'unidade') return 'Já existe um gestor cadastrado para a unidade "' + unidade + '".';
  if (role === 'equipe') return 'Já existe um enfermeiro/médico cadastrado para a equipe "' + equipe + '" da unidade "' + unidade + '".';
  if (role === 'microarea') return 'Já existe um agente cadastrado para a microárea "' + microarea + '" da equipe "' + equipe + '" na unidade "' + unidade + '".';
  return 'Já existe um cadastro com esta combinação.';
}

// ─── POST /api/custom/register ──────────────────────────
routerAdd('POST', '/api/custom/register', function(c) {
  try {
    // ── Parse body (padrão do import_pacientes.pb.js) ──
    var body = {};
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
      }
    } catch (_) {
      try { body = c.parseBody() || {}; } catch (_2) { body = {}; }
    }

    var email = String(body.email || '').trim();
    var password = String(body.password || '');
    var passwordConfirm = String(body.passwordConfirm || '');
    var role = String(body.role || '').trim();
    var unidadeSaude = String(body.unidade_saude || '').trim();
    var equipe = String(body.equipe || '').trim();
    var microarea = String(body.microarea || '').trim();

    // ── Validações ──
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

    var dao;
    try { dao = $app.dao(); } catch(_) { dao = null; }
    if (!dao) return c.json(500, { code: 500, message: 'DAO indisponível.' });

    // ── Verificar email duplicado ──
    var emailFilter = 'email = "' + esc(email) + '"';
    if (exists(dao, emailFilter)) {
      return c.json(400, { code: 400, message: 'Este e-mail já está sendo utilizado por outro usuário.' });
    }

    // ── Verificar combinação duplicada ──
    var cFilter = comboFilter(role, unidadeSaude, equipe, microarea);
    if (cFilter && exists(dao, cFilter)) {
      return c.json(400, { code: 400, message: comboMsg(role, unidadeSaude, equipe, microarea) });
    }

    // ── Criar usuário ──
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

    if (errMsg.indexOf('unique') !== -1 || errMsg.indexOf('Unique') !== -1 || errMsg.indexOf('UNIQUE') !== -1) {
      return c.json(400, { code: 400, message: 'Já existe um cadastro com esta combinação de perfil e localização.' });
    }

    console.error('[register] CRASH:', errMsg);
    return c.json(500, { code: 500, message: 'Erro ao criar conta. Verifique os dados.' });
  }
});
