'use strict';
const { createPayments } = require('./payments.cjs');
const { createCommerce } = require('./commerce.cjs');
function createGateway(options = {}) {
  const env = options.env || process.env;
  return env.MERCADOPAGO_MODE === 'production' ? createCommerce(options) : createPayments(options);
}
module.exports = { createGateway };
