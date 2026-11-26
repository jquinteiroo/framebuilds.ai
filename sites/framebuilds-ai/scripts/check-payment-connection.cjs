'use strict';
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createPayments } = require('../netlify/lib/payments.cjs');
async function checkConnection(env = process.env) {
  const app = createPayments({ env });
  const event = { httpMethod: 'POST', headers: { origin: new URL(env.APP_URL || env.URL || 'http://localhost:3000').origin, 'content-type': 'application/json' }, body: JSON.stringify({ packageId: 'conteudo', attemptId: randomUUID() }) };
  const result = await app.checkout(event);
  const data = JSON.parse(result.body);
  if (result.statusCode !== 200) throw new Error(data.error);
  const statusResult = await app.status({ ...event, body: JSON.stringify({ receipt: data.receipt }) });
  const status = JSON.parse(statusResult.body);
  if (statusResult.statusCode !== 200) throw new Error(status.error);
  const directory = path.resolve(__dirname, '../.netlify');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'connection-test.json'), JSON.stringify({ checkedAt: new Date().toISOString(), ...data, status }, null, 2));
  return { connected: true, mode: data.mode, checkoutCreated: true, statusVerified: true, paymentStatus: status.status, webhookConfigured: Boolean(env.MERCADOPAGO_WEBHOOK_SECRET), paid: status.status === 'approved' };
}
module.exports = { checkConnection };
if (require.main === module) checkConnection().then(console.log).catch(error => { console.error(error.message); process.exitCode = 1; });
