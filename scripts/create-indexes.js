#!/usr/bin/env node
/**
 * Cria índices na coleção amarcap53_pacientes via PocketBase API.
 *
 * Uso:
 *   node scripts/create-indexes.js <email> <senha>
 *
 * Exemplo:
 *   node scripts/create-indexes.js admin@exemplo.com minhasenha123
 */

import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';
const COLLECTION = 'amarcap53_pacientes';

const INDEXES = [
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

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error('Uso: node scripts/create-indexes.js <email> <senha>');
    process.exit(1);
  }

  const pb = new PocketBase(PB_URL);

  // Autenticar como superuser
  console.log('Autenticando...');
  await pb.collection('_superusers').authWithPassword(email, password);
  console.log('Autenticado com sucesso.');

  const collection = await pb.collections.getOne(COLLECTION);
  const existingIndexes = collection.indexes || [];

  // Verificar se idx_cns já existe
  const hasCns = existingIndexes.some(idx => typeof idx === 'string' && idx.includes('cns'));

  if (hasCns) {
    console.log('Índice idx_cns já existe. Todos os índices necessários estão criados.');
    return;
  }

  console.log('Criando índice idx_cns...');

  const token = pb.authStore.token;
  const response = await fetch(`${PB_URL}/api/collections/${COLLECTION}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
    },
    body: JSON.stringify({
      indexes: [...existingIndexes, "CREATE INDEX `idx_cns` ON `amarcap53_pacientes` (`cns`)"]
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    console.error('Erro da API:', result.message || result);
    process.exit(1);
  }

  console.log('Índice idx_cns criado com sucesso!');
}

main().catch((err) => {
  console.error('Erro:', err?.message || err);
  process.exit(1);
});
