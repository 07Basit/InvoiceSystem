import { config } from './config';
import { logger } from './utils/logger';
import app from './app';
import { prisma } from './lib/prisma';

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');

    app.listen(config.PORT, () => {
      logger.info(`Server running`, {
        port: config.PORT,
        env: config.NODE_ENV,
        url: `http://localhost:${config.PORT}`,
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received — shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received — shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

bootstrap();
