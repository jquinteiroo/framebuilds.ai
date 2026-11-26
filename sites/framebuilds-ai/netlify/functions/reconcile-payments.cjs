'use strict';
const { createCommerce } = require('../lib/commerce.cjs');
exports.handler = async () => {
  if (process.env.MERCADOPAGO_MODE !== 'production') return { statusCode: 200 };
  await createCommerce().reconcileEvents();
  return { statusCode: 200 };
};
