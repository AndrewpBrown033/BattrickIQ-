#!/usr/bin/env node
/**
 * If server.ts is truncated, restore from a known-good commit on GitHub,
 * then apply minAge/maxAge transfer form patch.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const SERVER = path.join(__dirname, '..', 'server.ts');
const GOOD_RAW =
  'https://raw.githubusercontent.com/AndrewpBrown033/BattrickIQ-/f371da2a1618a5c7903322dde14c92476fe1c54e/server.ts';

function isBroken(src) {
  if (!src || src.length < 2000) return true;
  if (/PLACEHOLDER/i.test(src)) return true;
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

function applyAgePatch() {
  const patch = path.join(__dirname, 'patch-server-age.cjs');
  if (!fs.existsSync(patch)) return;
  const r = spawnSync(process.execPath, [patch], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
}

async function main() {
  let current = '';
  try {
    current = fs.readFileSync(SERVER, 'utf8');
  } catch {
    current = '';
  }
  if (isBroken(current)) {
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
  } else {
    console.log('server.ts OK (' + current.length + ' bytes)');
  }
  applyAgePatch();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
