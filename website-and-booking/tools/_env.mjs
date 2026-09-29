// Shared by the tools/*.mjs scripts: reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
// from .dev.vars (gitignored) and re-exports the Functions' sbRequest helper.
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const env = {};
for (const line of fs.readFileSync(path.join(root, '.dev.vars'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
export { sbRequest } from '../functions/_supabase.js';
