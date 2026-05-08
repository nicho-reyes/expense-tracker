#!/usr/bin/env node
const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');

const root = resolve(__dirname, '..');

const envVars = {};
try {
  readFileSync(resolve(root, '.env'), 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq > 0) envVars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    });
} catch {}

const googleClientId = envVars['NG_APP_GOOGLE_CLIENT_ID'] || '';

const template = (production) => `export const environment = {
  production: ${production},
  googleClientId: '${googleClientId}',
  sheetsApiBaseUrl: 'https://sheets.googleapis.com/v4/spreadsheets',
  gisScriptUrl: 'https://accounts.google.com/gsi/client',
};
`;

writeFileSync(resolve(root, 'src/environments/environment.ts'), template(false));
writeFileSync(resolve(root, 'src/environments/environment.production.ts'), template(true));

console.log('Environment files generated from .env');
