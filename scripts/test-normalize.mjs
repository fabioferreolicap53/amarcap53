import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, '..', 'BASE123.csv');

const CSV_COLUMNS = 11;

function normalizeCSV(text) {
  const cleanText = text.replace(/\r/g, '');
  const lines = cleanText.split('\n').filter(l => l.trim());
  if (lines.length === 0) return text;

  const header = lines[0];
  const dataLines = lines.slice(1);

  const normalizedLines = [];

  for (const line of dataLines) {
    const values = line.split(',');
    for (let i = 0; i + CSV_COLUMNS - 1 < values.length; i += CSV_COLUMNS) {
      const chunk = values.slice(i, i + CSV_COLUMNS);
      normalizedLines.push(chunk.join(','));
    }
  }

  return [header, ...normalizedLines].join('\n');
}

// Teste
const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
console.log(`Original: ${(csvContent.length / 1024 / 1024).toFixed(2)} MB, ${csvContent.split('\n').length} linhas`);

const normalized = normalizeCSV(csvContent);
console.log(`Normalizado: ${(normalized.length / 1024 / 1024).toFixed(2)} MB, ${normalized.split('\n').length} linhas`);

// Parseia e conta registros
Papa.parse(normalized, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    const data = results.data;
    console.log(`\nRegistros parseados: ${data.length}`);
    
    // Field count distribution
    const counts = {};
    data.forEach(row => {
      const c = Object.keys(row).length;
      counts[c] = (counts[c] || 0) + 1;
    });
    console.log('Distribuição de campos:', counts);
    
    // Amostra
    console.log('\nPrimeiro registro:');
    const first = data[0];
    Object.keys(first).forEach(k => {
      console.log(`  ${k}: ${String(first[k]).slice(0, 60)}`);
    });
    
    // Verifica se dna_hpv_gal está limpo
    const invalidDnaHpv = data.filter(r => {
      const val = r['dna_hpv_gal'] || '';
      return val && !/^\d{4}-\d{2}-\d{2}$/.test(val.trim()) && val.trim().length > 12;
    });
    console.log(`\nRegistros com dna_hpv_gal inválido (contaminado): ${invalidDnaHpv.length}`);
    if (invalidDnaHpv.length > 0) {
      console.log('Amostra:', invalidDnaHpv.slice(0, 3).map(r => r['dna_hpv_gal']));
    }

    // CNS duplicados
    const cnsSet = new Set();
    const dups = [];
    data.forEach(r => {
      if (cnsSet.has(r.cns)) dups.push(r.cns);
      cnsSet.add(r.cns);
    });
    console.log(`\nCNS únicos: ${cnsSet.size}, duplicados: ${dups.length}`);
  }
});
