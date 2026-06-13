// server.js — Entry point
// Imports the configured Express app and starts the HTTP server.
// This file should stay minimal — all configuration lives in app.js.

import 'dotenv/config';
import app from './app.js';
import { testConnection } from './config/database.js';
import { logger } from './utils/logger.js';
import { APP } from './config/constants.js';

const PORT = APP.PORT;

app.listen(PORT, async () => {
  logger.info(`${APP.NAME} v${APP.VERSION} running on http://localhost:${PORT}`);
  await testConnection();
});