const fs = require('fs');
const path = 'node_modules/react-dom/cjs/react-dom-client.development.js';
const c = fs.readFileSync(path, 'utf8');
const re = /&&\s*\n?\s*console\.info\(\s*"%cDownload the React DevTools[\s\S]*?"font-weight:bold"\s*\)\s*;/;
if (re.test(c)) {
  fs.writeFileSync(path, c.replace(re, '&& false'));
  console.log('PATCHED react-dom');
} else {
  console.log('Already patched or pattern not found');
}
