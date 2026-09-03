// fix_relink_cns.pb.js
// Endpoint ÚNICO: re-vincula acompanhamentos a pacientes por CNS
// GET /api/custom/fix-relink-cns — sem body, sem auth complexa

routerAdd('GET', '/api/custom/fix-relink-cns', function(c) {
  var db = null;
  try { db = $app.db(); } catch(e) {}
  if (!db) {
    try { return c.json(500, {ok:false, err:'no db'}); } catch(e) { return nil; }
  }

  var result = { ok: false, step: '', before: 0, after: 0, err: '' };

  try {
    // 1. Contar huérfãos antes
    var r1 = db.newQuery("SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos WHERE (paciente IS NULL OR paciente = '') OR NOT EXISTS (SELECT 1 FROM amarcap53_pacientes WHERE id = amarcap53_acompanhamentos.paciente)").all();
    result.before = (r1 && r1.length > 0) ? r1[0].get('cnt') : 0;
    result.step = 'counted';

    // 2. Fix: UPDATE paciente = (SELECT p.id FROM pacientes p WHERE p.cns = acomp.cns)
    //    WHERE: acomp.cns != '' AND (paciente invalido)
    try {
      db.newQuery("UPDATE amarcap53_acompanhamentos SET paciente = (SELECT p.id FROM amarcap53_pacientes p WHERE p.cns = amarcap53_acompanhamentos.cns LIMIT 1) WHERE amarcap53_acompanhamentos.cns IS NOT NULL AND amarcap53_acompanhamentos.cns != '' AND ((amarcap53_acompanhamentos.paciente IS NULL OR amarcap53_acompanhamentos.paciente = '') OR NOT EXISTS (SELECT 1 FROM amarcap53_pacientes WHERE id = amarcap53_acompanhamentos.paciente)) AND EXISTS (SELECT 1 FROM amarcap53_pacientes WHERE cns = amarcap53_acompanhamentos.cns)").execute();
      result.step = 'updated';
    } catch(updErr) {
      result.err = 'update: ' + (updErr && updErr.message ? updErr.message : String(updErr));
    }

    // 3. Contar huérfãos depois
    var r2 = db.newQuery("SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos WHERE (paciente IS NULL OR paciente = '') OR NOT EXISTS (SELECT 1 FROM amarcap53_pacientes WHERE id = amarcap53_acompanhamentos.paciente)").all();
    result.after = (r2 && r2.length > 0) ? r2[0].get('cnt') : 0;
    result.ok = true;

  } catch(err) {
    result.err = (err && err.message) ? err.message : String(err);
  }

  try { return c.json(200, result); } catch(e) { return nil; }
});
