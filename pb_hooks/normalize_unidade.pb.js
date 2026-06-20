// normalize_unidade.pb.js
// Collapse double+ spaces in unidade field on save + fix existing on boot

// ─── Fix existing records at bootstrap ─────────────────
onBootstrap(function() {
  var dao = $app.dao();
  if (!dao) return;

  try {
    // Multiple passes to collapse 3+ spaces
    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = trim(unidade) WHERE unidade != trim(unidade)").execute();
    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = REPLACE(unidade, '  ', ' ') WHERE unidade LIKE '%  %'").execute();
    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = REPLACE(unidade, '  ', ' ') WHERE unidade LIKE '%  %'").execute();
    console.log('[normalize_unidade] Bootstrap fix OK — double spaces collapsed');
  } catch (e) {
    console.error('[normalize_unidade] Bootstrap error:', (e && e.message) || e);
  }
}, false);

// ─── Normalize on create ───────────────────────────────
onRecordBeforeCreateRequest(function(e) {
  if (e.collection.name !== 'amarcap53_pacientes') return;
  var u = e.record.get('unidade');
  if (u && typeof u === 'string') {
    e.record.set('unidade', u.trim().replace(/\s+/g, ' '));
  }
});

// ─── Normalize on update ───────────────────────────────
onRecordBeforeUpdateRequest(function(e) {
  if (e.collection.name !== 'amarcap53_pacientes') return;
  var u = e.record.get('unidade');
  if (u && typeof u === 'string') {
    e.record.set('unidade', u.trim().replace(/\s+/g, ' '));
  }
});

// ─── Custom route: trigger fix for existing records ───
routerAdd('POST', '/api/custom/fix-unidade-whitespace', function(c) {
  var auth = c.auth;
  if (!auth) return c.json(401, { message: 'Nao autenticado' });

  var dao = $app.dao();
  if (!dao) return c.json(500, { message: 'DAO indisponivel' });

  try {
    var affected = 0;
    // Count then fix (in case bootstrap didn't run yet)
    var before = dao.db().newQuery("SELECT COUNT(*) as total FROM amarcap53_pacientes WHERE unidade LIKE '%  %'").one();
    if (before && before.get) {
      affected = before.get('total') || 0;
    }
    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = trim(unidade) WHERE unidade != trim(unidade)").execute();
    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = REPLACE(unidade, '  ', ' ') WHERE unidade LIKE '%  %'").execute();
    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = REPLACE(unidade, '  ', ' ') WHERE unidade LIKE '%  %'").execute();
    return c.json(200, { success: true, fixed: affected, message: 'Whitespace normalizado em ' + affected + ' registros' });
  } catch (e) {
    return c.json(500, { message: (e && e.message) || 'Erro interno' });
  }
});
