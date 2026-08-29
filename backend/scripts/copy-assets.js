// Plain JS (not compiled) so it can run as a postbuild step without ts-node.
// tsc only emits .ts -> .js; static assets like the RAG knowledge base
// markdown files need to be copied into dist/ alongside the compiled code.
const fs = require('fs');
const path = require('path');

const copies = [{ from: 'src/ai/knowledge', to: 'dist/ai/knowledge' }];

for (const { from, to } of copies) {
  const src = path.join(__dirname, '..', from);
  const dest = path.join(__dirname, '..', to);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, dest, { recursive: true });
  console.log(`[copy-assets] ${from} -> ${to}`);
}
