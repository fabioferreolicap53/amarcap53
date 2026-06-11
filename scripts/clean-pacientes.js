/**
 * clean-pacientes.js
 * 1. GET schema completo (backup)
 * 2. Tenta DELETE collection inteira
 *    - Sucesso: recria coleção (instantâneo)
 *    - Falha (dependency): fallback — delete records concorrente
 * 3. Backup sempre salvo antes de qualquer ação
 */

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASSWORD = '@Cap5364125';
const COLLECTION = 'amarcap53_pacientes';
const PAGE_SIZE = 100;
const CONCURRENCY = 20;

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('  CLEAN-PACIENTES — Backup + Delete + Recreate');
  console.log('='.repeat(60));
  console.log(`\nPocketBase: ${PB_URL}`);
  console.log(`Coleção: ${COLLECTION}\n`);

  // 1. Auth
  process.stdout.write('[1/4] Autenticando... ');
  const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!authRes.ok) {
    console.error(`FALHOU (${authRes.status})`);
    process.exit(1);
  }

  const { token } = await authRes.json();
  const headers = { Authorization: token, 'Content-Type': 'application/json' };
  const authHeaders = { Authorization: token };
  console.log('OK');

  // 2. GET schema + backup
  process.stdout.write('[2/4] Obtendo schema + backup... ');
  const schemaRes = await fetch(`${PB_URL}/api/collections/${COLLECTION}`, {
    headers: authHeaders,
  });

  if (!schemaRes.ok) {
    console.error(`FALHOU (${schemaRes.status}) — coleção não existe?`);
    process.exit(1);
  }

  const schema = await schemaRes.json();
  const fieldNames = (schema.schema || []).map(f => f.name);
  const fieldCount = schema.schema?.length || 0;
  const rules = {
    listRule: schema.listRule,
    viewRule: schema.viewRule,
    createRule: schema.createRule,
    updateRule: schema.updateRule,
    deleteRule: schema.deleteRule,
  };

  const backupDir = path.join(__dirname, 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backupPath = path.join(backupDir, `${COLLECTION}_schema_${ts}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(schema, null, 2));
  console.log('OK');
  console.log(`  Campos (${fieldCount}): ${fieldNames.join(', ')}`);
  console.log(`  Backup: ${path.relative(process.cwd(), backupPath)}`);

  // 3. Tentar DELETE collection inteira
  process.stdout.write('[3/4] Deletando coleção... ');
  const startTime = Date.now();
  const delRes = await fetch(`${PB_URL}/api/collections/${schema.id}`, {
    method: 'DELETE',
    headers: authHeaders,
  });

  if (delRes.ok) {
    // Sucesso — recriar coleção
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`OK (${elapsed}s) — collection deletada`);

    process.stdout.write('[4/4] Recriando coleção... ');
    const createRes = await fetch(`${PB_URL}/api/collections`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: COLLECTION,
        type: schema.type || 'base',
        schema: schema.schema,
        indexes: schema.indexes || [],
        listRule: rules.listRule,
        viewRule: rules.viewRule,
        createRule: rules.createRule,
        updateRule: rules.updateRule,
        deleteRule: rules.deleteRule,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      console.error(`FALHOU (${createRes.status})`);
      console.error(JSON.stringify(err, null, 2));
      console.error('\nATENÇÃO: Coleção original deletada! Restaure via backup.');
      process.exit(1);
    }

    const newCol = await createRes.json();
    console.log('OK');

    const verifyRes = await fetch(
      `${PB_URL}/api/collections/${COLLECTION}/records?page=1&perPage=1`,
      { headers: authHeaders }
    );
    const { totalItems } = await verifyRes.json();

    printResult({
      method: 'DELETE + RECREATE',
      id: newCol.id,
      records: totalItems,
      fieldCount,
      fieldNames,
      rules,
      backupPath,
      elapsed: ((Date.now() - startTime) / 1000).toFixed(1),
    });

  } else {
    // Dependency error — fallback records delete
    console.log(`DEPENDENCY (${delRes.status}) — usando delete records`);

    process.stdout.write('\n[4/4] Deletando records (concorrente)... ');

    // Contar
    const countRes = await fetch(
      `${PB_URL}/api/collections/${COLLECTION}/records?page=1&perPage=1`,
      { headers: authHeaders }
    );
    const { totalItems } = await countRes.json();
    console.log(`${totalItems} registros`);

    if (totalItems === 0) {
      printResult({ method: 'JÁ VAZIA', records: 0, fieldCount, fieldNames, rules, backupPath, elapsed: '0' });
      return;
    }

    // Coletar IDs
    const allIds = [];
    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    for (let page = 1; page <= totalPages; page++) {
      const res = await fetch(
        `${PB_URL}/api/collections/${COLLECTION}/records?page=${page}&perPage=${PAGE_SIZE}`,
        { headers: authHeaders }
      );
      const data = await res.json();
      for (const item of data.items) allIds.push(item.id);
      process.stdout.write(`\rColetando: ${allIds.length}/${totalItems}`);
    }

    console.log(`\nDeletando ${allIds.length} records...\n`);
    let ok = 0, fail = 0;

    for (let i = 0; i < allIds.length; i += CONCURRENCY) {
      const batch = allIds.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(id =>
          fetch(`${PB_URL}/api/collections/${COLLECTION}/records/${id}`, {
            method: 'DELETE',
            headers: authHeaders,
          }).then(r => { if (r.ok) ok++; else fail++; })
          .catch(() => { fail++; })
        )
      );
      process.stdout.write(`\rDeletando: ${i + batch.length}/${allIds.length} — OK: ${ok} — Falhas: ${fail}`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const verifyRes = await fetch(
      `${PB_URL}/api/collections/${COLLECTION}/records?page=1&perPage=1`,
      { headers: authHeaders }
    );
    const { totalItems: remaining } = await verifyRes.json();

    printResult({
      method: 'RECORDS DELETE (fallback)',
      records: ok,
      remaining,
      fail,
      fieldCount,
      fieldNames,
      rules,
      backupPath,
      elapsed,
    });
  }
}

function printResult({ method, id, records, remaining, fail, fieldCount, fieldNames, rules, backupPath, elapsed }) {
  const rulesCount = Object.values(rules).filter(v => v !== null).length;
  console.log('\n\n' + '='.repeat(60));
  console.log('  RESULTADO');
  console.log('='.repeat(60));
  console.log(`  Método: ${method}`);
  if (id) console.log(`  Novo ID: ${id}`);
  console.log(`  Registros: ${records}${remaining !== undefined ? ` (restantes: ${remaining})` : ''}`);
  if (fail !== undefined) console.log(`  Falhas: ${fail}`);
  console.log(`  Tempo: ${elapsed}s`);
  console.log(`  Campos: ${fieldCount} (${fieldNames.join(', ')})`);
  console.log(`  Rules: ${rulesCount}/${Object.keys(rules).length}`);
  console.log(`  Backup: ${path.relative(process.cwd(), backupPath)}`);
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Erro:', err);
  process.exit(1);
});
