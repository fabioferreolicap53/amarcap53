import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, '..', 'BASE123.csv');

const content = fs.readFileSync(CSV_PATH, 'utf-8').replace(/\r/g, '');
const lines = content.split('\n').filter(l => l.trim());

console.log(`Total linhas: ${lines.length}`);
console.log(`Header: ${lines[0]}`);

// Para cada linha, conta valores e resto
let totalValues = 0;
let perLine = [];
for (let i = 1; i < lines.length; i++) {
  const vals = lines[i].split(',');
  const cnt = vals.length;
  totalValues += cnt;
  perLine.push({ line: i, values: cnt, mod: cnt % 11, modRemainder: cnt % 11 });
}

console.log(`\nTotal de valores (excluindo header): ${totalValues}`);
console.log(`Registros esperados (total/11): ${totalValues / 11}`);

// Verifica mod 11 distribution
let byMod = {};
perLine.forEach(p => {
  byMod[p.mod] = (byMod[p.mod] || 0) + 1;
});
console.log('\nDistribuição de mod 11 por linha:');
Object.keys(byMod).sort((a,b) => byMod[b] - byMod[a]).forEach(k => {
  console.log(`  mod ${k}: ${byMod[k]} linhas`);
});

// Verifica se o primeiro registro do primeiro chunk está correto
const line1 = lines[1];
const vals1 = line1.split(',');
console.log(`\nLinha 1: ${vals1.length} valores (mod 11 = ${vals1.length % 11})`);
console.log(`Primeiros 22 valores:`);
for (let i = 0; i < Math.min(22, vals1.length); i++) {
  console.log(`  [${i}] "${vals1[i].slice(0, 50)}"`);
}

// Simula o chunking de 11 em 11 na linha 1
console.log(`\nSimulando chunking (11 em 11) na linha 1:`);
const chunks = [];
for (let i = 0; i + 10 < vals1.length; i += 11) {
  const chunk = vals1.slice(i, i + 11);
  chunks.push(chunk);
}
console.log(`Total chunks: ${chunks.length}`);
if (chunks.length > 0) {
  console.log(`Chunk 0 (índices 0-10):`);
  console.log(`  unidade: "${chunks[0][0].slice(0, 40)}"`);
  console.log(`  dna_hpv_gal: "${chunks[0][10].slice(0, 40)}"`);
}
if (chunks.length > 1) {
  console.log(`\nChunk 1 (índices 11-21):`);
  console.log(`  unidade: "${chunks[1][0].slice(0, 40)}"`);
  console.log(`  dna_hpv_gal: "${chunks[1][10].slice(0, 40)}"`);
}
if (chunks.length > 89) {
  console.log(`\nChunk 89 (último - índices ${chunks.length*11-11}-${chunks.length*11-1}):`);
  console.log(`  unidade: "${chunks[89][0].slice(0, 40)}"`);
  console.log(`  dna_hpv_gal: "${chunks[89][10].slice(0, 40)}"`);
}

// Verifica valores restantes (ignorados)
const remaining = vals1.length % 11;
if (remaining > 0) {
  const startIdx = chunks.length * 11;
  console.log(`\nValores ignorados (índices ${startIdx}-${vals1.length-1}):`);
  for (let i = startIdx; i < vals1.length; i++) {
    console.log(`  [${i}] "${vals1[i].slice(0, 50)}"`);
  }
}
