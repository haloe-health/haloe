// Generates a VAPID key pair for web push (admin alerts).
//
//   node website-and-booking/tools/gen-vapid.mjs            # prints both keys
//   node website-and-booking/tools/gen-vapid.mjs --dev-vars # appends them to website-and-booking/.dev.vars
//                                                           # (gitignored) and prints ONLY the public key
//
// VAPID_PUBLIC_KEY  — base64url, 65-byte uncompressed P-256 point. Public: it is baked into app/index.html
//                     (VAPID_PUBLIC) and must be the SAME value as the Cloudflare secret.
// VAPID_PRIVATE_KEY — base64url, the 32-byte private scalar. SECRET: Cloudflare Pages secret only, never in code.
//
// Regenerating invalidates every existing subscription (devices must re-enable alerts in Settings).
import { webcrypto as crypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
const pub = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));   // 0x04 || X || Y
const publicKey = b64u(pub), privateKey = jwk.d;

if (process.argv.includes('--dev-vars')) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.dev.vars');
  let cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  cur = cur.split(/\r?\n/).filter((l) => !/^VAPID_(PUBLIC|PRIVATE)_KEY=/.test(l)).join('\n').replace(/\n*$/, '\n');
  fs.writeFileSync(file, cur + `VAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\n`);
  console.log('Written to .dev.vars (gitignored).\nVAPID_PUBLIC_KEY=' + publicKey);
} else {
  console.log('VAPID_PUBLIC_KEY=' + publicKey + '\nVAPID_PRIVATE_KEY=' + privateKey);
}
