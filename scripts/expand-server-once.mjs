import fs from 'fs';
const parts = [0,1,2,3].map(i => {
  try { return fs.readFileSync(`scripts/server.b64.${i}`, 'utf8'); } catch { return ''; }
}).join('');
if (parts.length < 1000) {
  console.error('expand-server-once: missing b64 parts', parts.length);
  process.exit(1);
}
const buf = Buffer.from(parts, 'base64');
fs.writeFileSync('server.ts', buf);
console.log('restored server.ts', buf.length, 'bytes');
