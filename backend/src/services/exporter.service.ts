import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { ExporterProfileDto } from 'shared';

const fields = (dto: ExporterProfileDto) => ({
  name: dto.name,
  address: dto.address,
  contact: dto.contact,
  email: dto.email ?? null,
});

async function getOrThrow(id: string) {
  const profile = await prisma.exporterProfile.findUnique({ where: { id } });
  if (!profile) throw new AppError('Exporter profile not found', 404, 'EXPORTER_PROFILE_NOT_FOUND');
  return profile;
}

/** After the default goes away, the most recently used active profile takes over. */
async function promoteNext() {
  const next = await prisma.exporterProfile.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
  if (next) await prisma.exporterProfile.update({ where: { id: next.id }, data: { isDefault: true } });
}

export const exporterService = {
  /** Default first, then newest. */
  async list() {
    return prisma.exporterProfile.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  },

  /** The profile a new invoice starts from. */
  async getDefault() {
    return prisma.exporterProfile.findFirst({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
  },

  /** The first profile created becomes the default automatically. */
  async create(dto: ExporterProfileDto) {
    const count = await prisma.exporterProfile.count();
    return prisma.exporterProfile.create({ data: { ...fields(dto), isDefault: count === 0 } });
  },

  async update(id: string, dto: ExporterProfileDto) {
    await getOrThrow(id);
    return prisma.exporterProfile.update({ where: { id }, data: fields(dto) });
  },

  async setDefault(id: string) {
    const target = await getOrThrow(id);
    if (!target.isActive) throw new AppError('Make this profile active before choosing it as the default', 400, 'EXPORTER_PROFILE_INACTIVE');
    const [, profile] = await prisma.$transaction([
      prisma.exporterProfile.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } }),
      prisma.exporterProfile.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return profile;
  },

  /** "Not needed" profiles stay saved but are not offered on new invoices; an inactive profile is never the default. */
  async setActive(id: string, isActive: boolean) {
    const profile = await getOrThrow(id);
    const updated = await prisma.exporterProfile.update({ where: { id }, data: { isActive, ...(isActive ? {} : { isDefault: false }) } });
    if (!isActive && profile.isDefault) await promoteNext();
    return updated;
  },

  /** Invoices keep their own copy, so deleting a profile never changes them. */
  async remove(id: string) {
    const profile = await getOrThrow(id);
    await prisma.exporterProfile.delete({ where: { id } });
    if (profile.isDefault) await promoteNext();
  },
};
