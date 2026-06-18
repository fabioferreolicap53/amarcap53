import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.resolve(__dirname, '..', 'BASE123.csv');

const csvContent = fs.readFileSync(csvPath, 'utf-8');

Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
  complete: (results) => {
    const rawData = results.data;
    console.log(`Total rows: ${rawData.length}`);
    
    // Check first row keys
    if (rawData.length > 0) {
      console.log('\nFirst row keys:');
      const first = rawData[0];
      Object.keys(first).forEach((k, i) => {
        console.log(`  [${i}] "${k}" = "${String(first[k]).slice(0, 50)}"`);
      });
    }
    
    // Check row with 12 fields
    for (let i = 0; i < rawData.length; i++) {
      const keys = Object.keys(rawData[i]);
      if (keys.length === 12) {
        console.log(`\nFirst row with 12 keys (index ${i}):`);
        keys.forEach((k, j) => {
          console.log(`  [${j}] "${k}" = "${String(rawData[i][k]).slice(0, 60)}"`);
        });
        break;
      }
    }
    
    // Find a row where the 12th key has a value
    for (let i = 0; i < rawData.length; i++) {
      const keys = Object.keys(rawData[i]);
      if (keys.length >= 12) {
        const val = rawData[i][keys[11]];
        if (val && val.trim()) {
          console.log(`\nFirst row with non-empty 12th field (index ${i}):`);
          console.log(`  12th key: "${keys[11]}" = "${val.slice(0, 80)}"`);
          break;
        }
      }
    }
    
    // Count null/empty key names
    let emptyKeyCount = 0;
    for (let i = 0; i < rawData.length; i++) {
      const keys = Object.keys(rawData[i]);
      keys.forEach(k => {
        if (!k || k.trim() === '') emptyKeyCount++;
      });
    }
    console.log(`\nRows with empty key name: ${emptyKeyCount}`);
    
    // Check the raw CSV last few chars
    console.log('\nCSV last 200 chars:');
    console.log(csvContent.slice(-200));
    
    // Check the raw CSV first 200 chars
    console.log('\nCSV first 200 chars:');
    console.log(csvContent.slice(0, 200));
  }
});
