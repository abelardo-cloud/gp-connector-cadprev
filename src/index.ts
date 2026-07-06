import { createServer } from './api/server.js';
import { env } from './config/env.js';

const app = createServer();

app.listen(env.port, () => {
  console.log(`[${env.serviceName}] Server listening on http://localhost:${env.port}`);
});
