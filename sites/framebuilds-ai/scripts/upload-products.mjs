import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { getStore } from '@netlify/blobs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogue = JSON.parse(await fs.readFile(path.join(root, 'packages.json'), 'utf8'));
const source = process.argv[2];
if (!source) throw new Error('Informe a pasta com conteudo.zip, estrategia.zip, sites.zip, video.zip e completo.zip.');
if (!process.env.NETLIFY_SITE_ID || !process.env.NETLIFY_AUTH_TOKEN) throw new Error('Configure NETLIFY_SITE_ID e NETLIFY_AUTH_TOKEN somente no ambiente local para enviar os arquivos privados.');
const directory = await fs.realpath(source);
const prepared = [];
for (const pack of catalogue.packages) {
  const fileName = pack.id + '.zip';
  const data = await fs.readFile(path.join(directory, fileName));
  if (data.length < 22 || data.length > 20 * 1024 * 1024 || data[0] !== 80 || data[1] !== 75) throw new Error('Arquivo ZIP inválido ou maior que 20 MiB: ' + fileName);
  const sha256 = createHash('sha256').update(data).digest('hex');
  prepared.push({ id: pack.id, data, entry: { key: 'packages/' + sha256 + '.zip', sha256, size: data.length, fileName } });
}
const store = getStore({ name: 'framebuilds-products', siteID: process.env.NETLIFY_SITE_ID, token: process.env.NETLIFY_AUTH_TOKEN, consistency: 'strong' });
for (const { data, entry } of prepared) {
  const saved = await store.set(entry.key, data, { onlyIfNew: true, metadata: { sha256: entry.sha256, size: entry.size } });
  if (!saved.modified) {
    const existing = await store.getMetadata(entry.key);
    if (existing?.metadata?.sha256 !== entry.sha256 || existing.metadata.size !== entry.size) throw new Error('Conflito de versão do arquivo privado.');
  }
}
// The manifest contains hashes and private object keys, never public file URLs.
await fs.writeFile(path.join(root, 'product-manifest.json'), JSON.stringify(Object.fromEntries(prepared.map(p => [p.id, p.entry])), null, 2) + '\n');
console.log(JSON.stringify({ uploaded: prepared.map(p => p.id), manifestWritten: true, salesOpened: false }));
