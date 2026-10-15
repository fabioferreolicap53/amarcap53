/**
 * Ancora todos os campos de data em 12:00:00.000Z (meio-dia UTC).
 *
 * Motivo: o PocketBase grava tudo em UTC ("2006-01-02 15:04:05.000Z").
 * Datas sem hora gravadas a meia-noite local (UTC-3) apareciam como 03:00
 * no painel (+3h). O meio-dia UTC nunca "vira o dia" em nenhum fuso.
 *
 * Idempotente: só reescreve a hora dos registros ainda não ancorados.
 * Nunca lança erro — falha aqui não pode impedir o boot.
 *
 * @param {import('pocketbase').PocketBase} pb
 */
export async function up(pb) {
  // Pega o acesso cru ao banco: no JSVM é o $app.db(); se o runner entregar
  // outra instância, tenta pb.db(). Se nada existir, sai em silêncio.
  var app = (typeof $app !== 'undefined' && $app) ? $app : pb;
  var db = null;
  try {
    if (app && typeof app.db === 'function') db = app.db();
    else if (pb && typeof pb.db === 'function') db = pb.db();
  } catch (e) {}
  if (!db) {
    console.log('[migration] fix_dates_midday_utc: acesso ao banco indisponível, pulando');
    return;
  }

  var targets = [
    { collection: 'amarcap53_pacientes', fields: ['data_nascimento', 'cito_lab', 'cito_pep', 'dna_hpv_gal', 'dna_hpv_pep'] },
    { collection: 'amarcap53_acompanhamentos', fields: ['data_busca', 'data_do_agendamento'] },
    { collection: 'amarcap53_pep_registros', fields: ['dna_hpv_pep'] }
  ];
  var anchor = "' 12:00:00.000Z'";

  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    try {
      var sets = t.fields
        .map(function(f) { return f + " = substr(" + f + ", 1, 10) || " + anchor; })
        .join(', ');
      var wheres = t.fields
        .map(function(f) { return "(" + f + " != '' AND " + f + " IS NOT NULL AND " + f + " != (substr(" + f + ", 1, 10) || " + anchor + "))"; })
        .join(' OR ');
      db.newQuery("UPDATE " + t.collection + " SET " + sets + " WHERE " + wheres).execute();
      console.log('[migration] datas ancoradas em 12:00:00.000Z: ' + t.collection);
    } catch (err) {
      console.error('[migration] Falha ao ancorar datas de ' + t.collection + ' (continuando boot):', (err && err.message) || err);
    }
  }
}
