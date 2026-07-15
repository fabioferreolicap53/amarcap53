// unique_user.pb.js
// Enforce unique combination of role + unidade + equipe + microarea on user create/update

onRecordBeforeCreateRequest(function(e) {
  if (e.collection.name !== 'amarcap53_users') return;

  var role = e.record.get('role');
  var unidade = e.record.get('unidade_saude') || '';
  var equipe = e.record.get('equipe') || '';
  var microarea = e.record.get('microarea') || '';

  var dao = $app.dao();
  if (!dao) return;

  var filter = '';
  if (role === 'cap') {
    filter = 'role = "cap"';
  } else if (role === 'unidade') {
    filter = 'role = "unidade" && unidade_saude = "' + unidade + '"';
  } else if (role === 'equipe') {
    filter = 'role = "equipe" && unidade_saude = "' + unidade + '" && equipe = "' + equipe + '"';
  } else if (role === 'microarea') {
    filter = 'role = "microarea" && unidade_saude = "' + unidade + '" && equipe = "' + equipe + '" && microarea = "' + microarea + '"';
  }

  if (!filter) return;

  var existing = dao.findRecordsByFilter(
    'amarcap53_users',
    filter,
    '-created',
    1,
    0
  );

  if (existing && existing.length > 0) {
    throw new Error(400, 'Já existe um cadastro com esta combinação de perfil e localização.');
  }
});

onRecordBeforeUpdateRequest(function(e) {
  if (e.collection.name !== 'amarcap53_users') return;

  var role = e.record.get('role');
  var unidade = e.record.get('unidade_saude') || '';
  var equipe = e.record.get('equipe') || '';
  var microarea = e.record.get('microarea') || '';

  var dao = $app.dao();
  if (!dao) return;

  var filter = '';
  if (role === 'cap') {
    filter = 'role = "cap"';
  } else if (role === 'unidade') {
    filter = 'role = "unidade" && unidade_saude = "' + unidade + '"';
  } else if (role === 'equipe') {
    filter = 'role = "equipe" && unidade_saude = "' + unidade + '" && equipe = "' + equipe + '"';
  } else if (role === 'microarea') {
    filter = 'role = "microarea" && unidade_saude = "' + unidade + '" && equipe = "' + equipe + '" && microarea = "' + microarea + '"';
  }

  if (!filter) return;

  var existing = dao.findRecordsByFilter(
    'amarcap53_users',
    filter,
    '-created',
    10,
    0
  );

  // Exclude the current record being updated
  var recordId = e.record.id;
  var duplicate = existing.filter(function(r) { return r.id !== recordId; });

  if (duplicate.length > 0) {
    throw new Error(400, 'Já existe um cadastro com esta combinação de perfil e localização.');
  }
});
