// pb_hooks/main.pb.js
// Consolidação de todos os hooks do sistema AMAR
//
// ⚠️ REGRA OBRIGATÓRIA (PocketBase v0.23+ / v0.40):
// Cada handler de rota/hook é executado como um "programa separado" em um
// pool de runtimes goja (ver plugins/jsvm/jsvm.go). Por isso ele NÃO enxerga
// NENHUMA função/constante declarada no topo deste arquivo: qualquer helper
// global vira "ReferenceError: X is not defined" em runtime, e o PocketBase
// devolve ao cliente um 400 genérico ("Something went wrong...").
//
// Por isso, TODO helper/constante usado DENTRO de um handler é declarado
// DENTRO do próprio handler. As variáveis do topo servem apenas como
// argumento de registro de hook (avaliadas em tempo de carga, o que funciona).

var PACIENTES_COLL = 'amarcap53_pacientes';
var ACOMP_COLL = 'amarcap53_acompanhamentos';
var USERS_COLL = 'amarcap53_users';

// ─── HOOKS: USUÁRIOS ÚNICOS ─────────────────────────────
onRecordCreate(function(e) {
  // Cláusula inline (o handler não enxerga o escopo global do arquivo)
  function eqClause(equipe) {
    var norm = String(equipe || '').trim();
    if (!norm) return 'equipe = ""';
    var up = norm.toUpperCase();
    var normKey = up.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    var parts = ['equipe = "' + up.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'];
    if (normKey !== up) parts.push('equipe = "' + normKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
    return '(' + parts.join(' || ') + ')';
  }
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
    else if (role === 'equipe') filter = 'role = "equipe" && unidade_saude = "' + esc(unidade) + '" && ' + eqClause(equipe);
    else if (role === 'microarea') {
      var m = microarea.trim();
      if (m && m !== '0' && m !== 'N/A') filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && ' + eqClause(equipe) + ' && (microarea = "' + esc(m) + '" || microarea = ' + parseInt(m, 10) + ')';
      else filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && ' + eqClause(equipe) + ' && (microarea = "" || microarea = null || microarea = "N/A")';
    }

    if (filter) {
      var rows = $app.findRecordsByFilter('amarcap53_users', filter, '-created', 1, 0);
      if (rows && rows.length > 0) throw new Error('Ja existe um cadastro com esta combinacao.');
    }
  } catch (err) {
    if (err && err.message && err.message.indexOf('Ja existe') === 0) throw err;
    console.error('[unique_user] Create error:', err);
  }
  e.next();
}, USERS_COLL);

onRecordUpdate(function(e) {
  // Cláusula inline (idem create — escopo isolado por handler)
  function eqClause(equipe) {
    var norm = String(equipe || '').trim();
    if (!norm) return 'equipe = ""';
    var up = norm.toUpperCase();
    var normKey = up.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    var parts = ['equipe = "' + up.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'];
    if (normKey !== up) parts.push('equipe = "' + normKey.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
    return '(' + parts.join(' || ') + ')';
  }
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
    else if (role === 'equipe') filter = 'role = "equipe" && unidade_saude = "' + esc(unidade) + '" && ' + eqClause(equipe);
    else if (role === 'microarea') {
      var m = microarea.trim();
      if (m && m !== '0' && m !== 'N/A') filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && ' + eqClause(equipe) + ' && (microarea = "' + esc(m) + '" || microarea = ' + parseInt(m, 10) + ')';
      else filter = 'role = "microarea" && unidade_saude = "' + esc(unidade) + '" && ' + eqClause(equipe) + ' && (microarea = "" || microarea = null || microarea = "N/A")';
    }

    if (filter) {
      var selfId = rec.id;
      var rows = $app.findRecordsByFilter('amarcap53_users', filter, '-created', 10, 0);
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
    db.newQuery("UPDATE amarcap53_pacientes SET unidade = trim(unidade) WHERE unidade != trim(unidade)").execute();
    db.newQuery("UPDATE amarcap53_pacientes SET unidade = REPLACE(unidade, '  ', ' ') WHERE unidade LIKE '%  %'").execute();
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
      var pac = $app.findRecordById('amarcap53_pacientes', pacId);
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

// ─── HOOK: ANTES DE DELETAR PACIENTE (REMOVIDO) ────────────────────────
// Hook removido para evitar conflitos de versão do PocketBase.
// A sincronização de CNS agora é feita exclusivamente via rotas da API.

// ─── ROTAS CUSTOMIZADAS AMAR ─────────────────────────────────
// Nota: os cabeçalhos de CORS são definidos inline em cada handler (o handler
// não enxerga funções declaradas no escopo global do arquivo).

// 1. Sincronizar CNS nos acompanhamentos (POST)
routerAdd('OPTIONS', '/api/amar/migrate-acompanhamento-cns', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  return c.noContent(204);
});
routerAdd('POST', '/api/amar/migrate-acompanhamento-cns', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
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
routerAdd('OPTIONS', '/api/amar/fix-relink-cns', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  return c.noContent(204);
});
routerAdd('POST', '/api/amar/fix-relink-cns', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  var result = { ok: false, relinked: 0, scanned: 0, err: '' };
  try {
    var db = $app.db();

    // Abordagem UPDATE direto, sem ler resultados, usando casting text para garantir compatibilidade
    var queryStr = "UPDATE amarcap53_acompanhamentos " +
                   "SET paciente = (SELECT id FROM amarcap53_pacientes WHERE amarcap53_pacientes.cns = amarcap53_acompanhamentos.cns LIMIT 1) " +
                   "WHERE cns != '' AND cns IS NOT NULL";

    db.newQuery(queryStr).execute();

    result.ok = true;
    result.relinked = 1;
    return c.json(200, result);
  } catch (err) {
    result.err = String(err);
    return c.json(400, result);
  }
});

// 3. Importar pacientes (Corrigido com ID e Timestamps)
routerAdd('OPTIONS', '/api/amar/import-pacientes', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  return c.noContent(204);
});
routerAdd('POST', '/api/amar/import-pacientes', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");

  // Helpers inline (handlers não enxergam o escopo global do arquivo)
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

  try {
    var auth = c.auth;
    if (!auth) return c.json(401, { message: 'Nao autenticado' });

    var body = {};
    try { body = c.requestInfo().body || {}; } catch(e) {}

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
      db.newQuery("DELETE FROM amarcap53_pacientes").execute();
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

        db.newQuery("INSERT INTO amarcap53_pacientes (id, created, updated, unidade, equipe, microarea, cns, nome, data_nascimento, idade, grupo) VALUES (" +
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

// 4. Excluir todos os registros de uma coleção (POST)
// OBS: a lógica é duplicada inline em cada rota (delete-all e drop-pacientes)
// porque o handler NÃO enxerga funções do escopo global do arquivo.
//
// delete-all   -> rota usada pelo frontend atual
// drop-pacientes -> alias mantido para builds antigos do frontend
routerAdd('OPTIONS', '/api/amar/delete-all', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  return c.noContent(204);
});
routerAdd('POST', '/api/amar/delete-all', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  try {
    var coll = '';
    try { coll = c.requestInfo().body.collection; } catch(e) {}
    if (!coll) return c.json(400, { message: 'Envie collection', build: '2026-10-06-delete-v2' });
    if (String(coll).indexOf('amarcap53_') !== 0) return c.json(400, { message: 'Colecao invalida', build: '2026-10-06-delete-v2' });

    var db = $app.db();

    // Se for excluir pacientes, sincroniza CNS nos acompanhamentos primeiro
    if (coll === 'amarcap53_pacientes') {
      try {
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

// Alias de compatibilidade: builds antigos do frontend chamam drop-pacientes
routerAdd('OPTIONS', '/api/amar/drop-pacientes', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  return c.noContent(204);
});
routerAdd('POST', '/api/amar/drop-pacientes', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  try {
    var coll = '';
    try { coll = c.requestInfo().body.collection; } catch(e) {}
    if (!coll) return c.json(400, { message: 'Envie collection', build: '2026-10-06-delete-v2' });
    if (String(coll).indexOf('amarcap53_') !== 0) return c.json(400, { message: 'Colecao invalida', build: '2026-10-06-delete-v2' });

    var db = $app.db();

    if (coll === 'amarcap53_pacientes') {
      try {
        db.newQuery(
          "UPDATE amarcap53_acompanhamentos " +
          "SET cns = (SELECT cns FROM amarcap53_pacientes WHERE id = amarcap53_acompanhamentos.paciente) " +
          "WHERE (cns = '' OR cns IS NULL) " +
          "AND paciente IN (SELECT id FROM amarcap53_pacientes)"
        ).execute();
      } catch(e) { console.error('[drop-pacientes] Sync CNS error:', e); }
    }

    db.newQuery("DELETE FROM " + coll).execute();
    return c.json(200, { success: true });
  } catch(err) {
    return c.json(500, { message: String(err) });
  }
});
