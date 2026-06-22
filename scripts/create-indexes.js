#!/usr/bin/env node
import PocketBase from 'pocketbase';

const PB_URL = 'https://centraldedados.dev.br';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error('Uso: node scripts/create-indexes.js <email> <senha>');
    process.exit(1);
  }

  const pb = new PocketBase(PB_URL);
  console.log('Autenticando...');
  await pb.collection('_superusers').authWithPassword(email, password);
  console.log('OK');
  const token = pb.authStore.token;

  // Helper: criar índice se não existe
  async function ensureIndex(collectionName, indexSql, checkStr) {
    const col = await pb.collections.getOne(collectionName);
    const existing = col.indexes || [];
    const exists = existing.some(i => typeof i === 'string' && i.includes(checkStr));
    if (exists) {
      console.log(`  ✓ ${checkStr} já existe`);
      return;
    }
    console.log(`  + Criando ${checkStr}...`);
    const resp = await fetch(`${PB_URL}/api/collections/${collectionName}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ indexes: [...existing, indexSql] }),
    });
    const r = await resp.json();
    if (!resp.ok) { console.error(`  ✗ Erro: ${r.message}`); } else { console.log(`  ✓ Criado`); }
  }

  console.log('\n--- amarcap53_pacientes ---');
  await ensureIndex('amarcap53_pacientes',
    "CREATE INDEX `idx_cns` ON `amarcap53_pacientes` (`cns`)", 'cns');

  console.log('\n--- amarcap53_acompanhamentos ---');
  await ensureIndex('amarcap53_acompanhamentos',
    "CREATE INDEX `idx_acomp_paciente` ON `amarcap53_acompanhamentos` (`paciente`)", 'paciente');

  console.log('\nConcluído.');
}

main().catch(err => { console.error('Erro:', err?.message || err); process.exit(1); });
