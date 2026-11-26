export function adapt(action) {
  return async request => {
    const url = new URL(request.url);
    const result = await action({
      httpMethod: request.method,
      headers: Object.fromEntries(request.headers),
      queryStringParameters: Object.fromEntries(url.searchParams),
      body: ['GET', 'HEAD'].includes(request.method) ? '' : await request.text(),
      isBase64Encoded: false,
    });
    return new Response(result.body, { status: result.statusCode, headers: result.headers });
  };
}
