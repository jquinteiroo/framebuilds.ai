import provisioning from '../lib/product-provisioner.cjs';
import { createHash, timingSafeEqual } from 'node:crypto';
import preflight from '../../scripts/check-production.cjs';
export default async request => {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const secret = process.env.FRAMEBUILDS_UPLOAD_TOKEN || '';
    const given = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
    const expiry = Number(process.env.FRAMEBUILDS_UPLOAD_EXPIRES);
    if (secret.length < 64 || !Number.isFinite(expiry) || expiry <= Date.now() || !timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(secret).digest())) return new Response(null, { status: 404 });
    return Response.json(await preflight.checkProduction(), { headers: { 'Cache-Control': 'no-store' } });
  }
  const handler = provisioning.createProvisioner();
  const result = await handler({ httpMethod: request.method, headers: Object.fromEntries(request.headers),
    queryStringParameters: Object.fromEntries(url.searchParams), isBase64Encoded: true,
    body: request.method === 'POST' ? Buffer.from(await request.arrayBuffer()).toString('base64') : '' });
  return new Response(result.body, { status: result.statusCode, headers: result.headers });
};
