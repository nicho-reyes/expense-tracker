#!/usr/bin/env node
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const { resolve, dirname } = require('path');

const root = resolve(__dirname, '..');

const envVars = {};
try {
  readFileSync(resolve(root, '.env'), 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq > 0) envVars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    });
} catch {}

const config = {
  googleClientId: envVars['NG_APP_GOOGLE_CLIENT_ID'] || '',
};

const outPath = resolve(root, 'public/config.json');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(config, null, 2) + '\n');

console.log(`Wrote ${outPath}`);
