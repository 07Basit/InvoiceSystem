import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

logger.info('Prisma client initialized');

if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}
