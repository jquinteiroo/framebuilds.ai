// Keep the SDK visible to Netlify's dependency tracer for CJS services.
import 'mercadopago';
import gateway from '../lib/payment-gateway.cjs';
import { adapt } from '../lib/function-adapter.mjs';
export default adapt(event => gateway.createGateway().config(event));
