/**
 * Índices da coleção de acompanhamentos (guia §6.1).
 * Idempotente: só cria índices que ainda não existem.
 * Nunca lança erro — falha aqui não pode impedir o boot do PocketBase.
 *
 * @param {import('pocketbase').PocketBase} pb
 */
export async function up(pb) {
  try {
    const collection = await pb.collections.getOne('amarcap53_acompanhamentos');
    const existing = collection.indexes || [];

    const newIndexes = [
      { name: 'idx_acomp_paciente', fields: ['paciente'] },
      { name: 'idx_acomp_cns', fields: ['cns'] },
    ];

    for (const idx of newIndexes) {
      // Aceita formato objeto ({name, fields}) e formato SQL cru (string)
      const alreadyExists = existing.some(e =>
        (e && typeof e === 'object' && e.name === idx.name) ||
        (typeof e === 'string' && e.includes(idx.name))
      );
      if (alreadyExists) {
        console.log(`[migration] ${idx.name} já existe`);
        continue;
      }

      // Re-lê a coleção a cada criação para não perder índices anteriores
      const fresh = await pb.collections.getOne('amarcap53_acompanhamentos');
      await pb.collections.update('amarcap53_acompanhamentos', {
        indexes: [...(fresh.indexes || []), idx],
      });
      console.log(`[migration] índice criado: ${idx.name}`);
    }
  } catch (err) {
    console.error('[migration] Erro ao criar índices de acompanhamentos (continuando boot):', err?.message || err);
  }
}
