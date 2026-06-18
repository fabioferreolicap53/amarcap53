import fs from 'fs';

const csvPath = 'C:/Users/Usuário/Desktop/PROJETOS - DEV/amarcap53/BASE123.csv';
const content = fs.readFileSync(csvPath, 'utf-8');

// Replace BOM
const cleanContent = content.replace(/^\ufeff/, '');
const lines = cleanContent.split('\n').filter(l => l.trim());

console.log('=== HEADER ===');
console.log(lines[0].split(',').map((v, i) => `  [${i}] "${v}"`).join('\n'));
console.log('Contagem header:', lines[0].split(',').length);

console.log('\n=== PRIMEIRA LINHA (primeiros 15 valores) ===');
const vals = lines[1].split(',');
console.log(`Total: ${vals.length}`);
for (let i = 0; i < Math.min(15, vals.length); i++) {
  console.log(`  [${i}] "${vals[i]}" (${vals[i].length} chars)`);
}

// Verifica os 3 campos vazios entre "25-29" e "SMS CF"
console.log('\n=== VERIFICANDO POSIÇÃO DO "25-29" ===');
const pos25_29 = vals.indexOf('25-29');
console.log(`Índice de "25-29": ${pos25_29}`);
if (pos25_29 >= 0) {
  for (let i = pos25_29; i < Math.min(pos25_29 + 6, vals.length); i++) {
    console.log(`  [${i}] "${vals[i]}" (len=${vals[i].length})`);
  }
}

console.log('\n=== LINHA 1 RAW (primeiros 500 chars) ===');
console.log(lines[1].slice(0, 500));

console.log('\n=== VERIFICANDO SE EXISTE BOM ===');
console.log('BOM no header?', content.charCodeAt(0) === 0xFEFF);
console.log('BOM no cleanContent?', cleanContent.charCodeAt(0) === 0xFEFF);

// Verifica se o cabeçalho tem 11 campos
const headerVals = lines[0].split(',');
console.log('\nCampos do header:', headerVals.length);
console.log('Primeiro campo do header:', JSON.stringify(headerVals[0]));
console.log('charCodeAt(0) primeiro campo:', headerVals[0].charCodeAt(0));
