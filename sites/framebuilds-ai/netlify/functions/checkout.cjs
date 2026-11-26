'use strict';
const { createGateway } = require('../lib/payment-gateway.cjs');
exports.handler = event => createGateway().checkout(event);
