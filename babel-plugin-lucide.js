const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'node_modules/lucide-react-native');
const index = fs.readFileSync(path.join(root, 'dist/esm/lucide-react-native.js'), 'utf8');
const files = {};
for (const match of index.matchAll(/export \{([^}]+)\} from '\.\/icons\/([^']+)';/g)) {
  for (const part of match[1].split(',')) {
    const name = part.trim().replace(/^default as /, '');
    if (name) files[name] = match[2];
  }
}

module.exports = function lucideImports({types: t}) {
  return {
    visitor: {
      ImportDeclaration(declaration) {
        const {node} = declaration;
        if (node.source.value !== 'lucide-react-native' || node.importKind === 'type') return;
        const kept = [];
        const direct = [];
        for (const specifier of node.specifiers) {
          const file = t.isImportSpecifier(specifier) && specifier.importKind !== 'type' ? files[specifier.imported.name] : null;
          if (file) direct.push(t.importDeclaration([t.importDefaultSpecifier(t.identifier(specifier.local.name))], t.stringLiteral('lucide-react-native/dist/esm/icons/' + file)));
          else kept.push(specifier);
        }
        if (!direct.length) return;
        if (kept.length) declaration.insertAfter(t.importDeclaration(kept, node.source));
        declaration.replaceWithMultiple(direct);
      },
    },
  };
};
