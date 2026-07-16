// register.pb.js
// POST /api/custom/register — cadastro com validação ATÔMICA server-side
// Usa dao.runInTransaction() + SQL direto para eliminar race condition

function getDao() {
  try { return $app.dao(); } catch(e) { return null; }
}

// Conta registros via SQL direto (mais confiável que findRecordsByFilter)
function countBySql(dao, where) {
  try {
    var row = dao.db().newQuery(
      'SELECT COUNT(*) as total FROM amarcap53_users WHERE ' + where
    ).one();
    return (row && row.get) ? (row.get('total') || 0) : 0;
  } catch (e) {
    console.error('[register] SQL error:', e.message, 'WHERE:', where);
    return -1; // -1 = erro (fail-closed)
  }
}

// ─── POST /api/custom/register ──────────────────────────
routerAdd('POST', '/api/custom/register', function(c) {
  try {
    // ── Parse body ──
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

    var dao = getDao();
    if (!dao) return c.json(500, { code: 500, message: 'DAO indisponível.' });

    // ── Escapa valor para SQL (substitui aspas simples) ──
    function sqlEsc(v) {
      return String(v || '').replace(/'/g, "''");
    }

    // ── Verificações ANTES da transação (leitura rápida) ──
    // Email duplicado
    var emailCount = countBySql(dao, "email = '" + sqlEsc(email) + "'");
    if (emailCount === -1) {
      return c.json(500, { code: 500, message: 'Erro ao verificar e-mail. Tente novamente.' });
    }
    if (emailCount > 0) {
      return c.json(400, { code: 400, message: 'Este e-mail já está sendo utilizado por outro usuário.' });
    }

    // Combinação duplicada
    var comboWhere = "role = '" + sqlEsc(role) + "'";
    if (role === 'unidade') {
      comboWhere += " AND unidade_saude = '" + sqlEsc(unidadeSaude) + "'";
    } else if (role === 'equipe') {
      comboWhere += " AND unidade_saude = '" + sqlEsc(unidadeSaude) + "' AND equipe = '" + sqlEsc(equipe) + "'";
    } else if (role === 'microarea') {
      comboWhere += " AND unidade_saude = '" + sqlEsc(unidadeSaude) + "' AND equipe = '" + sqlEsc(equipe) + "' AND microarea = '" + sqlEsc(microarea) + "'";
    }

    var comboCount = countBySql(dao, comboWhere);
    if (comboCount === -1) {
      return c.json(500, { code: 500, message: 'Erro ao validar combinação. Tente novamente.' });
    }
    if (comboCount > 0) {
      var msg = 'Já existe um cadastro com esta combinação.';
      if (role === 'cap') msg = 'Já existe um usuário cadastrado para a Coordenação (CAP).';
      else if (role === 'unidade') msg = 'Já existe um gestor cadastrado para a unidade "' + unidadeSaude + '".';
      else if (role === 'equipe') msg = 'Já existe um enfermeiro/médico cadastrado para a equipe "' + equipe + '" da unidade "' + unidadeSaude + '".';
      else if (role === 'microarea') msg = 'Já existe um agente cadastrado para a microárea "' + microarea + '" da equipe "' + equipe + '" na unidade "' + unidadeSaude + '".';
      return c.json(400, { code: 400, message: msg });
    }

    // ── Transação ATÔMICA: re-verifica + cria ──
    var createdRecord = null;

    dao.runInTransaction(function(txDao) {
      // Re-verifica email dentro da transação (proteção contra race condition)
      var emailCountTx = countBySql(txDao, "email = '" + sqlEsc(email) + "'");
      if (emailCountTx === -1) throw new Error('Erro ao verificar e-mail.');
      if (emailCountTx > 0) throw new Error('EMAIL_DUPLICADO');

      // Re-verifica combinação dentro da transação
      var comboCountTx = countBySql(txDao, comboWhere);
      if (comboCountTx === -1) throw new Error('Erro ao validar combinação.');
      if (comboCountTx > 0) throw new Error('COMBO_DUPLICADO');

      // Cria o usuário
      var collection = txDao.findCollectionByNameOrId('amarcap53_users');
      if (!collection) throw new Error('Coleção amarcap53_users não encontrada.');

      var record = new Record(collection);
      record.set('username', email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_') + Math.floor(Math.random() * 10000));
      record.set('email', email);
      record.set('emailVisibility', true);
      record.setPassword(password);
      record.set('unidade_saude', unidadeSaude);
      record.set('equipe', equipe);
      record.set('role', role);
      record.set('microarea', microarea);

      txDao.saveRecord(record);
      createdRecord = { id: record.id, email: email };
    });

    if (!createdRecord) {
      return c.json(500, { code: 500, message: 'Erro ao criar conta.' });
    }

    return c.json(200, {
      code: 200,
      message: 'Cadastro realizado com sucesso!',
      record: createdRecord
    });

  } catch (err) {
    var errMsg = (err && err.message) ? err.message : 'Erro inesperado.';

    // Erros de duplicata customizados
    if (errMsg === 'EMAIL_DUPLICADO') {
      return c.json(400, { code: 400, message: 'Este e-mail já está sendo utilizado por outro usuário.' });
    }
    if (errMsg === 'COMBO_DUPLICADO') {
      return c.json(400, { code: 400, message: 'Já existe um cadastro com esta combinação de perfil e localização.' });
    }

    // Unique constraint do SQLite
    if (errMsg.indexOf('unique') !== -1 || errMsg.indexOf('Unique') !== -1 || errMsg.indexOf('UNIQUE') !== -1) {
      return c.json(400, { code: 400, message: 'Já existe um cadastro com esta combinação de perfil e localização.' });
    }

    console.error('[register] CRASH:', errMsg);
    return c.json(500, { code: 500, message: 'Erro ao criar conta. Verifique os dados.' });
  }
});
