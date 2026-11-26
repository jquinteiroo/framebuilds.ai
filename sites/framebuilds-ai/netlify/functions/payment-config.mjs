import gateway from '../lib/payment-gateway.cjs';
import { adapt } from '../lib/function-adapter.mjs';
export default adapt(event => gateway.createGateway().config(event));
