// normalize_unidade.pb.js
// Collapse double+ spaces in unidade field on save + fix existing on boot
// PocketBase JS API: onBootstrap / onRecordCreate / onRecordUpdate
// ALL hooks MUST call e.next() to proceed

// ─── Fix existing records at bootstrap ─────────────────
onBootstrap(function(e) {
  try {
    var dao = $app.dao();
    if (!dao) { e.next(); return; }

    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = trim(unidade) WHERE unidade != trim(unidade)").execute();
    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = REPLACE(unidade, '  ', ' ') WHERE unidade LIKE '%  %'").execute();
    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = REPLACE(unidade, '  ', ' ') WHERE unidade LIKE '%  %'").execute();
  } catch (err) {
    // table might not exist yet, ignore
  }
  e.next();
});

// ─── Normalize on create ───────────────────────────────
onRecordCreate(function(e) {
  var u = e.record.get('unidade');
  if (u && typeof u === 'string') {
    e.record.set('unidade', u.trim().replace(/\s+/g, ' '));
  }
  e.next();
}, "amarcap53_pacientes");

// ─── Normalize on update ───────────────────────────────
onRecordUpdate(function(e) {
  var u = e.record.get('unidade');
  if (u && typeof u === 'string') {
    e.record.set('unidade', u.trim().replace(/\s+/g, ' '));
  }
  e.next();
}, "amarcap53_pacientes");

// ─── Custom route: trigger fix for existing records ───
routerAdd('POST', '/api/custom/fix-unidade-whitespace', function(c) {
  var auth = c.auth;
  if (!auth) return c.json(401, { message: 'Nao autenticado' });

  try {
    var dao = $app.dao();
    if (!dao) return c.json(500, { message: 'DAO indisponivel' });

    var affected = 0;
    var before = dao.db().newQuery("SELECT COUNT(*) as total FROM amarcap53_pacientes WHERE unidade LIKE '%  %'").one();
    if (before && before.get) { affected = before.get('total') || 0; }

    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = trim(unidade) WHERE unidade != trim(unidade)").execute();
    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = REPLACE(unidade, '  ', ' ') WHERE unidade LIKE '%  %'").execute();
    dao.db().newQuery("UPDATE amarcap53_pacientes SET unidade = REPLACE(unidade, '  ', ' ') WHERE unidade LIKE '%  %'").execute();

    return c.json(200, { success: true, fixed: affected, message: 'Whitespace normalizado em ' + affected + ' registros' });
  } catch (e) {
    var msg = (e && e.message) || 'Erro interno';
    return c.json(500, { message: msg });
  }
});
