import { prisma } from '../lib/prisma';
import type { UpsertExporterProfileDto } from 'shared';

export const exporterService = {
  async getProfile() {
    return prisma.exporterProfile.findFirst({ orderBy: { updatedAt: 'desc' } });
  },

  async upsertProfile(dto: UpsertExporterProfileDto) {
    const existing = await prisma.exporterProfile.findFirst({ orderBy: { updatedAt: 'desc' } });

    if (!existing) {
      return prisma.exporterProfile.create({
        data: {
          name: dto.name,
          address: dto.address,
          contact: dto.contact,
          email: dto.email ?? null,
          isLocked: dto.isLocked ?? false,
        },
      });
    }

    return prisma.exporterProfile.update({
      where: { id: existing.id },
      data: {
        name: dto.name,
        address: dto.address,
        contact: dto.contact,
        email: dto.email ?? null,
        isLocked: dto.isLocked ?? false,
      },
    });
  },
};
