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
      let content = fs.readFileSync(file, 'utf8');
      let modified = content;

      // Remove readOnly from StarRating
      if (file.endsWith('ReviewCard.tsx')) {
        modified = modified.replace(/\breadOnly(?:=\{.*?\})?/g, '');
      }

      // Remove fullWidth prop from inputs
      modified = modified.replace(/\bfullWidth(?:=\{.*?\})?/g, '');

      if (content !== modified) {
        fs.writeFileSync(file, modified);
      }
    }
  });
  return results;
}

walk('client/src');
