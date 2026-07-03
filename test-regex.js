const fs = require('fs');
const c = fs.readFileSync('node_modules/react-dom/cjs/react-dom-client.development.js', 'utf8');
const RE = /console\.info\(\s*"%cDownload the React DevTools[\s\S]*?"font-weight:bold"\s*\)\s*;/g;
const m = c.match(RE);
console.log('Match:', m ? m.length : 0);
if (m) console.log(m[0].substring(0, 200));
