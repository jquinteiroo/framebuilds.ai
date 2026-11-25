'use strict';
const { createPayments } = require('../lib/payments.cjs');
exports.handler = event => createPayments().checkout(event);
