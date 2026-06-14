const fs = require('fs');
const content = fs.readFileSync('src/screens/DashboardScreen.tsx', 'utf8');

// Find the return start
const retIdx = content.indexOf('return (');
const beforeReturn = content.substring(0, retIdx);
const afterReturn = content.substring(retIdx);

// Count braces in the return section
let openBraces = 0;
let closeBraces = 0;
let inBlockComment = false;
let inLineComment = false;
let inString = false;
let inTemplate = false;
let stringChar = '';

for (let i = 0; i < afterReturn.length; i++) {
    const ch = afterReturn[i];
    const next = afterReturn[i+1] || '';
    
    if (inBlockComment) {
        if (ch === '*' && next === '/') { inBlockComment = false; i++; }
        continue;
    }
    if (inLineComment) {
        if (ch === '\n') inLineComment = false;
        continue;
    }
    if (inString) {
        if (ch === '\\' && next) i++;
        else if (ch === stringChar) inString = false;
        continue;
    }
    if (inTemplate) {
        if (ch === '\\' && next) i++;
        else if (ch === '`') inTemplate = false;
        else if (ch === '$' && next === '{') { i++; openBraces++; }
        else if (ch === '}') closeBraces++;
        continue;
    }
    
    if (ch === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (ch === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
    if (ch === '`') { inTemplate = true; continue; }
    if (ch === '{') openBraces++;
    if (ch === '}') closeBraces++;
}

console.log('Open braces:', openBraces);
console.log('Close braces:', closeBraces);
console.log('Diff (open - close):', openBraces - closeBraces);
