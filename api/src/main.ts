import app from './app';
import { startExpiryCron } from './cron/expiry.cron';
import { assertEnv, env } from './lib/env';

assertEnv();
app.listen(env.port, () => {
  console.log(`Sikika Tickets API on :${env.port}${env.mpesa.simulate ? ' [M-Pesa SIMULATION]' : ''}`);
  startExpiryCron();
});
