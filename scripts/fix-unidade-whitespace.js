/**
 * fix-unidade-whitespace.js
 * Fix double+ spaces in amarcap53_pacientes.unidade field
 * Run: node scripts/fix-unidade-whitespace.js
 */

const PB_URL = 'https://centraldedados.dev.br';
const ADMIN_EMAIL = 'fabioferreoli@gmail.com';
const ADMIN_PASSWORD = '@Cap5364125';
const COLLECTION = 'amarcap53_pacientes';
const PAGE_SIZE = 200;

async function main() {
  console.log('=== FIX UNIDADE WHITESPACE ===\n');

  // 1. Auth
  process.stdout.write('Auth admin... ');
  const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!authRes.ok) {
    const txt = await authRes.text();
    console.error(`FAIL (${authRes.status})`);
    console.error(txt.slice(0, 200));
    process.exit(1);
  }
  const { token } = await authRes.json();
  const headers = { Authorization: token, 'Content-Type': 'application/json' };
  console.log('OK');

  // 2. Count affected
  process.stdout.write('Count records with double+ spaces... ');
  const countRes = await fetch(
    `${PB_URL}/api/collections/${COLLECTION}/records?page=1&perPage=1&filter=unidade~%22%20%20%22`,
    { headers }
  );
  if (!countRes.ok) {
    const txt = await countRes.text();
    console.error(`FAIL (${countRes.status})`);
    console.error(txt.slice(0, 200));
    process.exit(1);
  }
  const { totalItems } = await countRes.json();
  console.log(`${totalItems} records found`);

  if (totalItems === 0) {
    console.log('Nothing to fix.');
    return;
  }

  // 3. Fetch all affected records
  process.stdout.write(`Fetching ${totalItems} records... `);
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  const allIds = [];

  for (let page = 1; page <= totalPages; page++) {
    const res = await fetch(
      `${PB_URL}/api/collections/${COLLECTION}/records?page=${page}&perPage=${PAGE_SIZE}&filter=unidade~%22%20%20%22&fields=id,unidade`,
      { headers }
    );
    const data = await res.json();
    for (const item of data.items) allIds.push({ id: item.id, unidade: item.unidade });
  }
  console.log('OK');
  console.log(`  Samples: ${allIds.slice(0, 3).map(r => `"${r.unidade}"`).join(', ')}`);

  // 4. Fix each record
  console.log(`\nFixing ${allIds.length} records...`);
  let ok = 0, fail = 0;

  for (let i = 0; i < allIds.length; i++) {
    const { id, unidade } = allIds[i];
    const fixed = unidade.trim().replace(/\s+/g, ' ');

    if (fixed === unidade) {
      ok++;
      continue;
    }

    const updateRes = await fetch(
      `${PB_URL}/api/collections/${COLLECTION}/records/${id}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ unidade: fixed }),
      }
    );

    if (updateRes.ok) {
      ok++;
    } else {
      fail++;
      if (fail <= 3) {
        const txt = await updateRes.text();
        console.error(`  #${i + 1} FAIL: ${txt.slice(0, 100)}`);
      }
    }

    if ((i + 1) % 50 === 0 || i === allIds.length - 1) {
      process.stdout.write(`\r  ${i + 1}/${allIds.length} — OK: ${ok} — Fail: ${fail}`);
    }
  }

  console.log(`\n\nDone! Fixed: ${ok}, Errors: ${fail}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
