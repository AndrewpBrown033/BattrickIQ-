#!/usr/bin/env node
/**
 * If server.ts is the truncated placeholder, restore from a known-good commit on GitHub.
 * Runs before vite/esbuild so /api routes exist and clients get JSON not HTML.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const SERVER = path.join(__dirname, '..', 'server.ts');
const GOOD_RAW =
  'https://raw.githubusercontent.com/AndrewpBrown033/BattrickIQ-/8ad7e324247032458403ada3a7f968366816c790/server.ts';

function isBroken(src) {
  if (!src || src.length < 2000) return true;
  if (/PLACEHOLDER truncated/i.test(src)) return true;
  if (!/\/api\/sync-battrick-step/.test(src)) return true;
  return false;
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'BattrickIQ-restore' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return fetchText(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error('HTTP ' + res.statusCode + ' fetching ' + url));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

async function main() {
  let current = '';
  try {
    current = fs.readFileSync(SERVER, 'utf8');
  } catch {
    current = '';
  }
  if (!isBroken(current)) {
    console.log('server.ts OK (' + current.length + ' bytes)');
    return;
  }
  console.log(
    'server.ts looks truncated (' + current.length + ' bytes) — restoring from known-good commit…'
  );
  const body = await fetchText(GOOD_RAW);
  if (isBroken(body)) {
    console.error('Restored content still looks broken (' + body.length + ' bytes)');
    process.exit(1);
  }
  fs.writeFileSync(SERVER, body);
  console.log('Restored server.ts (' + body.length + ' bytes)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
