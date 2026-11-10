import { config } from './config.js';
import { createApp } from './app.js';
import { prisma } from './db.js';
import { logger } from './logger.js';
import { startSweeper } from './booking/sweeper.js';
import { startMailer } from './booking/notify.js';
import { startIntegrationWorker } from './integrations/worker.js';

const server = createApp().listen(config.PORT, () => logger.info(`API listening on :${config.PORT} (docs at /api/docs)`));
const stopSweeper = startSweeper();
const stopMailer = startMailer();
const stopIntegrations = startIntegrationWorker();
const stop = async () => { stopSweeper(); stopMailer(); stopIntegrations(); server.close(); await prisma.$disconnect(); process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
