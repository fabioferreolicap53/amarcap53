// acompanhamento_cns.pb.js
// Fix direto: confronta cns entre acompanhamentos e pacientes

// ═══════════════════════════════════════════════════════
// 1. FIX-DIRECT: re-vincula por CNS via SQL direto
//    GET (sem body) — zero dependências de parsing
// ═══════════════════════════════════════════════════════
routerAdd('GET', '/api/custom/fix-relink-cns', function(c) {
  try {
    var db = $app.db();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    var ACOMP = 'amarcap53_acompanhamentos';
    var PAC = 'amarcap53_pacientes';

    // Diagnóstico: ver estado atual
    var totalAcomps = db.newQuery('SELECT COUNT(*) as cnt FROM ' + ACOMP).all();
    var totalPacs = db.newQuery('SELECT COUNT(*) as cnt FROM ' + PAC).all();

    // PASSO 1: Atualizar cns de acompanhamentos que têm paciente válido
    // (para registros novos que foram criados com cns via frontend)
    try {
      db.newQuery(
        'UPDATE ' + ACOMP + ' SET cns = (' +
        '  SELECT p.cns FROM ' + PAC + ' p WHERE p.id = ' + ACOMP + '.paciente' +
        ') WHERE paciente IS NOT NULL AND paciente != "" AND cns IS NULL AND EXISTS (' +
        '  SELECT 1 FROM ' + PAC + ' p WHERE p.id = ' + ACOMP + '.paciente AND p.cns IS NOT NULL AND p.cns != ""' +
        ')'
      ).execute();
    } catch(_) {}

    // PASSO 2: Re-vincular por CNS — SQL direto
    // Para cada acompanhamento que tem cns mas paciente inválido/ausente,
    // encontrar paciente com mesmo cns e atualizar
    var relinked = db.newQuery(
      'UPDATE ' + ACOMP + ' SET paciente = (' +
      '  SELECT p.id FROM ' + PAC + ' p WHERE p.cns = ' + ACOMP + '.cns LIMIT 1' +
      ') WHERE cns IS NOT NULL AND cns != "" AND (' +
      '  paciente IS NULL OR paciente = "" OR NOT EXISTS (' +
      '    SELECT 1 FROM ' + PAC + ' p WHERE p.id = ' + ACOMP + '.paciente' +
      '  )' +
      ') AND EXISTS (' +
      '  SELECT 1 FROM ' + PAC + ' p WHERE p.cns = ' + ACOMP + '.cns' +
      ')'
    ).execute();

    // Contar resultado
    var comPaciente = db.newQuery(
      'SELECT COUNT(*) as cnt FROM ' + ACOMP + ' a WHERE a.paciente IS NOT NULL AND a.paciente != "" AND EXISTS (SELECT 1 FROM ' + PAC + ' p WHERE p.id = a.paciente)'
    ).all();
    var semPaciente = db.newQuery(
      'SELECT COUNT(*) as cnt FROM ' + ACOMP + ' a WHERE a.paciente IS NULL OR a.paciente = "" OR NOT EXISTS (SELECT 1 FROM ' + PAC + ' p WHERE p.id = a.paciente)'
    ).all();

    return c.json(200, {
      success: true,
      totalAcomps: totalAcomps.length > 0 ? totalAcomps[0].get('cnt') : 0,
      totalPacs: totalPacs.length > 0 ? totalPacs[0].get('cnt') : 0,
      comPacienteValido: comPaciente.length > 0 ? comPaciente[0].get('cnt') : 0,
      semPacienteValido: semPaciente.length > 0 ? semPaciente[0].get('cnt') : 0,
    });

  } catch(err) {
    return c.json(500, { message: (err && err.message) ? err.message : 'Erro' });
  }
});

// ═══════════════════════════════════════════════════════
// 2. MIGRATION: popular cns nos acompanhamentos existentes
// ═══════════════════════════════════════════════════════
routerAdd('POST', '/api/custom/migrate-acompanhamento-cns', function(c) {
  try {
    var db = $app.db();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    db.newQuery(
      'UPDATE amarcap53_acompanhamentos SET cns = (' +
      '  SELECT p.cns FROM amarcap53_pacientes p WHERE p.id = amarcap53_acompanhamentos.paciente' +
      ') WHERE paciente IS NOT NULL AND paciente != "" AND EXISTS (' +
      '  SELECT 1 FROM amarcap53_pacientes p WHERE p.id = amarcap53_acompanhamentos.paciente AND p.cns IS NOT NULL AND p.cns != ""' +
      ')'
    ).execute();

    var count = db.newQuery(
      'SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos WHERE cns IS NOT NULL AND cns != ""'
    ).all();
    var total = (count.length > 0) ? count[0].get('cnt') : 0;

    return c.json(200, { success: true, totalComCns: total });
  } catch(err) {
    return c.json(500, { message: (err && err.message) ? err.message : 'Erro' });
  }
});

// ═══════════════════════════════════════════════════════
// 3. DIAGNÓSTICO
// ═══════════════════════════════════════════════════════
routerAdd('GET', '/api/custom/diag-acompanhamentos', function(c) {
  try {
    var db = $app.db();
    if (!db) return c.json(500, { message: 'DB indisponivel' });

    var total = db.newQuery('SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos').all();
    var comCns = db.newQuery('SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos WHERE cns IS NOT NULL AND cns != ""').all();
    var comPaciente = db.newQuery('SELECT COUNT(*) as cnt FROM amarcap53_acompanhamentos WHERE paciente IS NOT NULL AND paciente != ""').all();
    var totalPac = db.newQuery('SELECT COUNT(*) as cnt FROM amarcap53_pacientes').all();

    return c.json(200, {
      acompanhamentos: {
        total: total.length > 0 ? total[0].get('cnt') : 0,
        comCns: comCns.length > 0 ? comCns[0].get('cnt') : 0,
        comPaciente: comPaciente.length > 0 ? comPaciente[0].get('cnt') : 0,
      },
      pacientes: {
        total: totalPac.length > 0 ? totalPac[0].get('cnt') : 0,
      }
    });
  } catch(err) {
    return c.json(500, { message: (err && err.message) ? err.message : 'Erro' });
  }
});
