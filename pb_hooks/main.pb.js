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
  // e.next() PRIMEIRO (obrigatório). O one-off do core que inicializa os
  // bancos (initDataDB/initAuxDB) é o ÚLTIMO handler da cadeia de bootstrap
  // (ver tools/hook.Target: os oneOff são `append` no fim). Se rodarmos SQL
  // cru ou $app.save() ANTES do e.next(), o ConcurrentDB ainda é nil e o
  // PocketBase morre no boot com "invalid memory address or nil pointer
  // dereference" em core.(*BaseApp).modelQuery. Depois do e.next() o banco e
  // as coleções já estão carregados.
  e.next();

  try {
    var db = $app.db();
    db.newQuery("UPDATE amarcap53_pacientes SET unidade = trim(unidade) WHERE unidade != trim(unidade)").execute();
    db.newQuery("UPDATE amarcap53_pacientes SET unidade = REPLACE(unidade, '  ', ' ') WHERE unidade LIKE '%  %'").execute();
  } catch (err) {}

  // Garante a TABELA CRUA de backup das datas DNA-HPV (PEP) indexada por CNS e
  // faz o snapshot inicial. É tabela SQLite pura (NÃO é coleção do PocketBase):
  // assim não depende do model/cache de collections, não corre risco de panic
  // de nil-pointer nem do erro "Collection name must be unique". Idempotente.
  try {
    var dbPep = $app.db();
    dbPep.newQuery(
      "CREATE TABLE IF NOT EXISTS amarcap53_pep_registros (" +
      "id TEXT PRIMARY KEY, cns TEXT, dna_hpv_pep TEXT)"
    ).execute();
    dbPep.newQuery(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_pep_reg_cns ON amarcap53_pep_registros (cns)"
    ).execute();

    // Autoritativo apenas para CNS que existem AGORA em pacientes: se a base
    // estiver vazia (meio de um ciclo delete/import) nada é removido.
    dbPep.newQuery(
      "DELETE FROM amarcap53_pep_registros " +
      "WHERE cns IN (SELECT cns FROM amarcap53_pacientes WHERE cns != '' AND cns IS NOT NULL)"
    ).execute();
    dbPep.newQuery(
      "INSERT OR REPLACE INTO amarcap53_pep_registros (id, cns, dna_hpv_pep) " +
      "SELECT substr(lower(hex(randomblob(12))), 1, 15), cns, dna_hpv_pep " +
      "FROM amarcap53_pacientes " +
      "WHERE dna_hpv_pep != '' AND dna_hpv_pep IS NOT NULL AND cns != '' AND cns IS NOT NULL"
    ).execute();
  } catch (err) {
    console.error('[pep_registros] Bootstrap error:', err);
  }
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

// ─── HOOK: BACKUP DNA-HPV (PEP) POR CNS ─────────────────────────────────
// Campo interativo editado pelos usuários no app. Sem isso, o DELETE da base
// durante o ciclo de reimportação apaga a data para sempre. Espelha o valor
// numa coleção à parte, chaveada pelo CNS (chave natural que sobrevive à
// reimportação). Nunca bloqueia o update do paciente (tudo em try/catch).
onRecordUpdate(function(e) {
  var rec = e.record;
  var cns = '', val = '', orig = '';
  try {
    cns = String(rec.get('cns') || '').trim();
    val = String(rec.get('dna_hpv_pep') || '').trim();
    try { orig = String(rec.original().get('dna_hpv_pep') || '').trim(); } catch (o) {}
  } catch (readErr) {}
  e.next();
  try {
    if (!cns || val === orig) return;
    if (val === '--') val = '';

    // Tabela CRUA SQLite (NÃO é coleção do PocketBase). CREATE TABLE IF NOT
    // EXISTS é idempotente e não depende do model/cache de collections: sem
    // panic de nil-pointer e sem o erro "Collection name must be unique".
    var db = $app.db();
    db.newQuery(
      "CREATE TABLE IF NOT EXISTS amarcap53_pep_registros (" +
      "id TEXT PRIMARY KEY, cns TEXT, dna_hpv_pep TEXT)"
    ).execute();
    db.newQuery(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_pep_reg_cns ON amarcap53_pep_registros (cns)"
    ).execute();

    function esc(v) { return "'" + String(v == null ? '' : v).replace(/'/g, "''") + "'"; }
    if (val === '') {
      db.newQuery("DELETE FROM amarcap53_pep_registros WHERE cns = " + esc(cns)).execute();
    } else {
      db.newQuery(
        "INSERT OR REPLACE INTO amarcap53_pep_registros (id, cns, dna_hpv_pep) " +
        "VALUES (substr(lower(hex(randomblob(12))), 1, 15), " + esc(cns) + ", " + esc(val) + ")"
      ).execute();
    }
  } catch (err) {
    console.error('[pep_registros] Hook error:', err);
  }
}, PACIENTES_COLL);

// ─── HOOKS: ACOMPANHAMENTOS (Auto-CNS & Sync) ───────────
onRecordCreate(function(e) {
  try {
    var rec = e.record;
    var pacId = String(rec.get('paciente') || '').trim();
    var currentCns = String(rec.get('cns') || '').trim();

    // Se já tem CNS (enviado pelo frontend), não faz nada
    if (currentCns !== '') {
      e.next();
      return;
    }

    if (pacId) {
      // SQL cru: $app.findRecordById dispara panic de Go (nil-pointer) neste
      // build quando o id não existe e derruba o serviço. A query direta
      // simplesmente retorna vazio.
      function esc(v) { return "'" + String(v == null ? '' : v).replace(/'/g, "''") + "'"; }
      var rows = $app.db().newQuery(
        "SELECT cns FROM amarcap53_pacientes WHERE id = " + esc(pacId) + " LIMIT 1"
      ).all();
      if (rows && rows.length > 0 && rows[0].cns) rec.set('cns', rows[0].cns);
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
    // Campos do PocketBase são NOT NULL: vazio deve virar '' (string vazia),
    // nunca NULL — senão o INSERT falha com "NOT NULL constraint failed".
    if (v === null || v === undefined) return "''";
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

      // Snapshot das datas DNA-HPV (PEP) por CNS antes do DELETE (idem delete-all)
      try {
        // Tabela CRUA SQLite (ver nota no bootstrap). Idempotente e sem os
        // problemas de criar/consultar Collection neste build.
        db.newQuery(
          "CREATE TABLE IF NOT EXISTS amarcap53_pep_registros (" +
          "id TEXT PRIMARY KEY, cns TEXT, dna_hpv_pep TEXT)"
        ).execute();
        db.newQuery("CREATE UNIQUE INDEX IF NOT EXISTS idx_pep_reg_cns ON amarcap53_pep_registros (cns)").execute();
        db.newQuery(
          "DELETE FROM amarcap53_pep_registros " +
          "WHERE cns IN (SELECT cns FROM amarcap53_pacientes WHERE cns != '' AND cns IS NOT NULL)"
        ).execute();
        db.newQuery(
          "INSERT OR REPLACE INTO amarcap53_pep_registros (id, cns, dna_hpv_pep) " +
          "SELECT substr(lower(hex(randomblob(12))), 1, 15), cns, dna_hpv_pep " +
          "FROM amarcap53_pacientes " +
          "WHERE dna_hpv_pep != '' AND dna_hpv_pep IS NOT NULL AND cns != '' AND cns IS NOT NULL"
        ).execute();
      } catch (pepErr0) { console.error('[import-pacientes] Snapshot dna_hpv_pep error:', pepErr0); }

      db.newQuery("DELETE FROM amarcap53_pacientes").execute();
    }

    var imported = 0;
    var now = new Date().toISOString().replace('T', ' ').split('.')[0];

    // INSERT multi-linha: 1 única sentença SQL = 1 transação atômica.
    // Muito mais rápido que 1 INSERT por registro e libera o lock de escrita
    // do SQLite quase instantaneamente (não trava os outros apps do servidor).
    var rows = [];
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var cns = padLeft(String(r.cns || '').replace(/\D/g, ''), 15, '0').slice(-15);
      if (!cns || !r.nome) continue;

      // Gerar ID aleatório de 15 caracteres (padrão PocketBase)
      var id = (Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 9)).substring(0, 15);

      rows.push("(" + escSql(id) + ", " + escSql(now) + ", " + escSql(now) + ", " +
        escSql(r.unidade) + ", " + escSql(r.equipe) + ", " + (parseInt(r.microarea, 10) || 0) + ", " +
        escSql(cns) + ", " + escSql(r.nome) + ", " + escSql(r.data_nascimento) + ", " +
        escSql(r.dna_hpv_pep) + ", " + escSql(r.cito_lab) + ", " + escSql(r.cito_pep) + ", " +
        escSql(r.dna_hpv_gal) + ", " + escSql(r.unidade_solicitante) + ", " +
        (parseInt(r.idade, 10) || 0) + ", " + escSql(r.grupo) + ")");
    }

    if (rows.length) {
      db.newQuery(
        "INSERT INTO amarcap53_pacientes " +
        "(id, created, updated, unidade, equipe, microarea, cns, nome, data_nascimento, " +
        "dna_hpv_pep, cito_lab, cito_pep, dna_hpv_gal, unidade_solicitante, idade, grupo) VALUES " +
        rows.join(",")
      ).execute();
      imported = rows.length;
    }

    // Restaura as datas DNA-HPV (PEP) salvas por CNS (coleção de backup).
    // Só preenche campos vazios — nunca sobrescreve valor vindo do CSV.
    try {
      db.newQuery(
        "UPDATE amarcap53_pacientes SET dna_hpv_pep = (" +
        "  SELECT p.dna_hpv_pep FROM amarcap53_pep_registros p " +
        "  WHERE p.cns = amarcap53_pacientes.cns AND p.dna_hpv_pep != '' LIMIT 1" +
        ") WHERE (dna_hpv_pep = '' OR dna_hpv_pep IS NULL) " +
        "AND EXISTS (SELECT 1 FROM amarcap53_pep_registros p " +
        "            WHERE p.cns = amarcap53_pacientes.cns AND p.dna_hpv_pep != '')"
      ).execute();
    } catch (pepErr) {
      console.error('[import-pacientes] Restore dna_hpv_pep error:', pepErr);
    }

    return c.json(200, { success: true, imported: imported, build: '2026-10-13-pep-backup-v1' });
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

      // Snapshot das datas DNA-HPV (PEP) por CNS ANTES de apagar a base.
      // Sem isso as datas editadas pelos usuários somem junto com os registros.
      try {
        // Tabela CRUA SQLite (ver nota no bootstrap). Idempotente e sem os
        // problemas de criar/consultar Collection neste build.
        db.newQuery(
          "CREATE TABLE IF NOT EXISTS amarcap53_pep_registros (" +
          "id TEXT PRIMARY KEY, cns TEXT, dna_hpv_pep TEXT)"
        ).execute();
        db.newQuery("CREATE UNIQUE INDEX IF NOT EXISTS idx_pep_reg_cns ON amarcap53_pep_registros (cns)").execute();
        // Remove o backup apenas dos CNS que existem agora (base cheia).
        // Se a base estiver vazia (meio do ciclo), nada é removido.
        db.newQuery(
          "DELETE FROM amarcap53_pep_registros " +
          "WHERE cns IN (SELECT cns FROM amarcap53_pacientes WHERE cns != '' AND cns IS NOT NULL)"
        ).execute();
        db.newQuery(
          "INSERT OR REPLACE INTO amarcap53_pep_registros (id, cns, dna_hpv_pep) " +
          "SELECT substr(lower(hex(randomblob(12))), 1, 15), cns, dna_hpv_pep " +
          "FROM amarcap53_pacientes " +
          "WHERE dna_hpv_pep != '' AND dna_hpv_pep IS NOT NULL AND cns != '' AND cns IS NOT NULL"
        ).execute();
      } catch (pepErr) { console.error('[delete-all] Snapshot dna_hpv_pep error:', pepErr); }
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

      // Snapshot das datas DNA-HPV (PEP) por CNS antes de apagar (idem delete-all)
      try {
        // Tabela CRUA SQLite (ver nota no bootstrap). Idempotente e sem os
        // problemas de criar/consultar Collection neste build.
        db.newQuery(
          "CREATE TABLE IF NOT EXISTS amarcap53_pep_registros (" +
          "id TEXT PRIMARY KEY, cns TEXT, dna_hpv_pep TEXT)"
        ).execute();
        db.newQuery("CREATE UNIQUE INDEX IF NOT EXISTS idx_pep_reg_cns ON amarcap53_pep_registros (cns)").execute();
        db.newQuery(
          "DELETE FROM amarcap53_pep_registros " +
          "WHERE cns IN (SELECT cns FROM amarcap53_pacientes WHERE cns != '' AND cns IS NOT NULL)"
        ).execute();
        db.newQuery(
          "INSERT OR REPLACE INTO amarcap53_pep_registros (id, cns, dna_hpv_pep) " +
          "SELECT substr(lower(hex(randomblob(12))), 1, 15), cns, dna_hpv_pep " +
          "FROM amarcap53_pacientes " +
          "WHERE dna_hpv_pep != '' AND dna_hpv_pep IS NOT NULL AND cns != '' AND cns IS NOT NULL"
        ).execute();
      } catch (pepErr) { console.error('[drop-pacientes] Snapshot dna_hpv_pep error:', pepErr); }
    }

    db.newQuery("DELETE FROM " + coll).execute();
    return c.json(200, { success: true });
  } catch(err) {
    return c.json(500, { message: String(err) });
  }
});
