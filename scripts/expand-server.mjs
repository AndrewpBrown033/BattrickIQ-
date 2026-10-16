import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(root, '..');
const parts = [];
for (let i = 1; i <= 20; i++) {
  const p = path.join(repo, `server.b64.${i}`);
  if (!fs.existsSync(p)) break;
  parts.push(fs.readFileSync(p, 'utf8'));
}
if (!parts.length) {
  console.log('[expand-server] no server.b64.* chunks — using existing server.ts');
  process.exit(0);
}
const src = Buffer.from(parts.join(''), 'base64').toString('utf8');
fs.writeFileSync(path.join(repo, 'server.ts'), src);
console.log('[expand-server] reconstructed server.ts from', parts.length, 'chunks (', src.length, 'chars)');
