/**
 * @param {import('pocketbase').PocketBase} pb
 */
export async function up(pb) {
  const collection = await pb.collections.getOne('amarcap53_pacientes');

  // Índices existentes do PocketBase
  const existingIndexes = (collection.indexes || []).map(idx => idx.name);

  const newIndexes = [
    {
      name: 'idx_rastreamento',
      fields: ['dna_hpv_pep', 'dna_hpv_gal', 'cito_pep', 'cito_lab'],
    },
    {
      name: 'idx_regional',
      fields: ['unidade', 'equipe', 'microarea'],
    },
    {
      name: 'idx_nome',
      fields: ['nome'],
    },
    {
      name: 'idx_cns',
      fields: ['cns'],
    },
    {
      name: 'idx_grupo',
      fields: ['grupo'],
    },
    {
      name: 'idx_regional_rastreamento',
      fields: ['unidade', 'equipe', 'dna_hpv_pep', 'dna_hpv_gal', 'cito_pep', 'cito_lab'],
    },
  ];

  // Adicionar apenas índices que não existem
  const indexesToAdd = newIndexes.filter(idx => !existingIndexes.includes(idx.name));

  if (indexesToAdd.length > 0) {
    await pb.collections.update('amarcap53_pacientes', {
      indexes: [...(collection.indexes || []), ...indexesToAdd],
    });
    console.log(`[migration] ${indexesToAdd.length} indexes created: ${indexesToAdd.map(i => i.name).join(', ')}`);
  } else {
    console.log('[migration] all indexes already exist');
  }
}
