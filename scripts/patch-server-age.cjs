/**
 * Add minAge/maxAge to Battrick transfer form builder on server.ts.
 * Idempotent. Safe after restore-server.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'server.ts');
let t = fs.readFileSync(file, 'utf8');
let changes = 0;

if (!t.includes('/api/sync-battrick-step') || t.length < 2000) {
  console.warn('[patch-server-age] server.ts looks broken — skip');
  process.exit(0);
}

const oldSig = 'function buildFormParams(html: string, skillMins: Record<string, number> = {}) {';
const newSig =
  'function buildFormParams(\n' +
  '    html: string,\n' +
  '    skillMins: Record<string, number> = {},\n' +
  '    age: { minAge?: number; maxAge?: number } = {}\n' +
  '  ) {';
if (t.includes(oldSig)) {
  t = t.replace(oldSig, newSig);
  changes++;
  console.log('[patch-server-age] signature');
}

const ageBlock =
  '    if (age.minAge != null && Number(age.minAge) > 0) {\n' +
  '      params.set("minAge", String(Math.round(Number(age.minAge))));\n' +
  '    } else {\n' +
  '      params.set("minAge", "");\n' +
  '    }\n' +
  '    if (age.maxAge != null && Number(age.maxAge) > 0 && Number(age.maxAge) < 50) {\n' +
  '      params.set("maxAge", String(Math.round(Number(age.maxAge))));\n' +
  '    } else {\n' +
  '      params.set("maxAge", "");\n' +
  '    }\n';

if (!t.includes('params.set("minAge"')) {
  // Insert age fields immediately before the main `return params` of buildFormParams
  const marker = '    return params;\n  }\n\n  app.post("/api/sync-battrick-step"';
  if (t.includes(marker)) {
    t = t.replace(marker, ageBlock + marker);
    changes++;
    console.log('[patch-server-age] minAge/maxAge fields');
  } else {
    console.warn('[patch-server-age] return-params marker not found');
  }
}

const oldCall = ': buildFormParams(html0, skillMins);';
const newCall =
  ': buildFormParams(html0, skillMins, {\n' +
  '                  minAge: req.body.minAge != null ? Number(req.body.minAge) : undefined,\n' +
  '                  maxAge: req.body.maxAge != null ? Number(req.body.maxAge) : undefined,\n' +
  '                });';
if (t.includes(oldCall)) {
  t = t.replace(oldCall, newCall);
  changes++;
  console.log('[patch-server-age] call site');
}

fs.writeFileSync(file, t);
console.log('[patch-server-age] done changes=', changes);
