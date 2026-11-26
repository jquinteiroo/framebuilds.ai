import provisioning from '../lib/product-provisioner.cjs';
export default async request => {
  const url = new URL(request.url);
  const handler = provisioning.createProvisioner();
  const result = await handler({ httpMethod: request.method, headers: Object.fromEntries(request.headers),
    queryStringParameters: Object.fromEntries(url.searchParams), isBase64Encoded: true,
    body: request.method === 'POST' ? Buffer.from(await request.arrayBuffer()).toString('base64') : '' });
  return new Response(result.body, { status: result.statusCode, headers: result.headers });
};
