import commerce from '../lib/commerce.cjs';
import shared from '../lib/payments.cjs';
const { createCommerce } = commerce;
const { PaymentError } = shared;
export default async request => {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' };
  try {
    if (request.method !== 'POST') return new Response(null, { status: 405, headers });
    const site = new URL(process.env.APP_URL || process.env.URL || 'http://localhost:3000');
    if (request.headers.get('origin') !== site.origin) return new Response(null, { status: 403, headers });
    // The capability travels in a header, never a query string or provider URL.
    const receipt = request.headers.get('authorization')?.replace(/^Bearer /, '');
    const asset = await createCommerce().authorizeDownload(receipt);
    return new Response(asset.stream, { headers: { ...headers, 'Content-Type': 'application/zip',
      'Content-Length': String(asset.size), 'Content-Disposition': 'attachment; filename="' + asset.fileName + '"' } });
  } catch (error) {
    return Response.json({ error: error instanceof PaymentError ? error.message : 'Não foi possível liberar o arquivo. Tente novamente.' },
      { status: error instanceof PaymentError ? error.status : 503, headers });
  }
};
