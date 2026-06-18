/**
 * Script de upload direto do BASE123.csv para o PocketBase.
 * Uso: node scripts/upload-base123.mjs <email> <password>
 * 
 * Lê o CSV, parseia com PapaParse, autentica, e envia via API.
 * Faz em lotes de 500 registros pra evitar timeout.
 */

import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, '..', 'BASE123.csv');
const PB_URL = 'https://centraldedados.dev.br';
const IMPORT_ENDPOINT = `${PB_URL}/api/custom/import-pacientes`;
const LOGIN_ENDPOINT = `${PB_URL}/api/admins/auth-with-password`;

const NORMALIZE = s => s.trim().replace(/\s+/g, ' ');

const parseDate = (dateStr) => {
  if (!dateStr || dateStr === '--' || dateStr.trim() === '') return null;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed;
  const parts = trimmed.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
};

async function main() {
  const args = process.argv.slice(2);
  let email, password;

  if (args.length >= 2) {
    [email, password] = args;
  } else {
    email = process.env.PB_EMAIL;
    password = process.env.PB_PASSWORD;
  }

  if (!email || !password) {
    console.error('Uso: node scripts/upload-base123.mjs <email> <password>');
    console.error('Ou defina PB_EMAIL e PB_PASSWORD como variáveis de ambiente.');
    process.exit(1);
  }

  console.log('=== UPLOAD BASE123.CSV ===');
  console.log();

  // 1. Autentica
  console.log('[1/4] Autenticando...');
  let token;
  try {
    const loginRes = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
    });
    if (!loginRes.ok) {
      const err = await loginRes.json();
      console.error('Falha na autenticação:', err);
      process.exit(1);
    }
    const loginData = await loginRes.json();
    token = loginData.token;
    console.log('  OK - Admin autenticado');
  } catch (e) {
    console.error('Erro de conexão:', e.message);
    process.exit(1);
  }

  // 2. Lê e parseia o CSV
  console.log('[2/4] Lendo CSV...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
  console.log(`  Tamanho: ${(csvContent.length / 1024 / 1024).toFixed(2)} MB`);

  const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  const rawData = parsed.data;
  console.log(`  Linhas lidas: ${rawData.length}`);

  // 3. Processa registros
  console.log('[3/4] Processando registros...');
  const records = rawData.map((rawRow) => {
    const row = {};
    Object.keys(rawRow).forEach(key => {
      row[key.trim().toUpperCase()] = rawRow[key];
    });

    const unidade = NORMALIZE(row['UNIDADE'] || '');
    const equipe = NORMALIZE(row['EQUIPE'] || '');
    const microarea = NORMALIZE(row['MICROÁREA'] || '') || NORMALIZE(row['MICROAREA'] || '') || NORMALIZE(row['MICRO'] || '');
    const cns = (row['CNS'] || '').trim();
    const nome = NORMALIZE(row['NOME'] || '');
    const dataNascimento = (row['NASC.'] || '').trim()
      || (row['DATA DE NASCIMENTO'] || '').trim()
      || (row['DATA NASCIMENTO'] || '').trim()
      || (row['NASCIMENTO'] || '').trim()
      || (row['DATA_NASCIMENTO'] || '').trim();
    const idade = (row['IDADE'] || '').trim();
    const grupo = NORMALIZE(row['GRUPO'] || '') || NORMALIZE(row['FAIXA ETÁRIA'] || '') || NORMALIZE(row['FAIXA ETARIA'] || '') || '';

    if (!(unidade && equipe && cns && nome && dataNascimento)) return null;

    const parsedDate = parseDate(dataNascimento);
    if (!parsedDate) return null;

    const rec = {
      unidade,
      equipe,
      microarea: parseInt(microarea) || 0,
      cns: cns.replace(/\D/g, '').padStart(15, '0').slice(-15),
      nome,
      data_nascimento: parsedDate,
      idade: parseInt(idade) || 0,
      grupo: grupo || '--',
    };

    const citoLab = parseDate(row['CITO LAB'] || row['RESULTADO DE CITO LABORATÓRIO'] || row['CITO_LAB']);
    if (citoLab) rec.cito_lab = citoLab;

    const citoPep = parseDate(row['CITO PEP'] || row['RESULTADO DE CITO REGISTRADO NO PEP'] || row['CITO_PEP']);
    if (citoPep) rec.cito_pep = citoPep;

    const dnaHpv = parseDate(row['DNA-HPV'] || row['TESTE MOLECULAR DNA-HPV'] || row['DNA_HPV_GAL']);
    if (dnaHpv) rec.dna_hpv_gal = dnaHpv;

    const alertas = row['ALERTAS RASTREAMENTO']?.trim();
    if (alertas) rec.alertas_rastreamento = alertas;

    return rec;
  }).filter(Boolean);

  console.log(`  Registros válidos: ${records.length} / ${rawData.length}`);

  if (records.length === 0) {
    console.error('Nenhum registro válido. Abortando.');
    process.exit(1);
  }

  // 4. Upload em lotes
  console.log('[4/4] Enviando para servidor...');
  const BATCH_SIZE = 500;
  let totalImported = 0;
  let totalErrors = 0;
  const allErrors = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    
    console.log(`  Lote ${batchNum}/${totalBatches} (${batch.length} registros)...`);
    
    try {
      const res = await fetch(IMPORT_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          records: batch,
          fileName: `BASE123_lote${batchNum}.csv`,
        }),
      });

      const result = await res.json();

      if (res.ok) {
        console.log(`    ✓ Importados: ${result.imported}, Erros: ${result.errors}`);
        totalImported += result.imported || 0;
        totalErrors += result.errors || 0;
        if (result.errorDetails?.length) {
          result.errorDetails.forEach(e => allErrors.push(e));
        }
      } else {
        console.error(`    ✗ Falha: ${result.message || res.status}`);
        if (result.rollback) {
          console.error('      Transação revertida (dados antigos preservados)');
        }
        totalErrors += batch.length;
      }
    } catch (e) {
      console.error(`    ✗ Erro de conexão: ${e.message}`);
      totalErrors += batch.length;
    }
  }

  // Resumo
  console.log();
  console.log('=== RESUMO ===');
  console.log(`Total enviado: ${records.length}`);
  console.log(`Importados: ${totalImported}`);
  console.log(`Falhas: ${totalErrors}`);
  if (allErrors.length > 0) {
    console.log(`\nDetalhes dos erros (${allErrors.length}):`);
    allErrors.slice(0, 5).forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  }
  console.log('\nConcluído!');
}

main().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
