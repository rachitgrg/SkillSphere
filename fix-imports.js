const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (file.includes('main.tsx') || file.includes('App.tsx') || file.includes('vite-env.d.ts') || file.includes('store.ts')) return;
      let content = fs.readFileSync(file, 'utf8');
      
      // Fix import Avatar from '../common/Avatar' -> import { Avatar } from '../common/Avatar'
      // Ignore css imports, and generic named imports like `import * as X`
      let modified = content.replace(/^import\s+([a-zA-Z0-9_]+)\s+from\s+(['"][\.\/]+.*['"])/gm, 'import { $1 } from $2');
      
      if (content !== modified) {
        fs.writeFileSync(file, modified);
      }
    }
  });
  return results;
}

walk('client/src');
