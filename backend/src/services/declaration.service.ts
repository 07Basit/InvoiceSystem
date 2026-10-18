import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { DeclarationProfileDto } from 'shared';

const fields = (dto: DeclarationProfileDto) => ({ name: dto.name, text: dto.text });

async function getOrThrow(id: string) {
  const profile = await prisma.declarationProfile.findUnique({ where: { id } });
  if (!profile) throw new AppError('Declaration profile not found', 404, 'DECLARATION_PROFILE_NOT_FOUND');
  return profile;
}

/** After the default goes away, the most recently used active profile takes over. */
async function promoteNext() {
  const next = await prisma.declarationProfile.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
  if (next) await prisma.declarationProfile.update({ where: { id: next.id }, data: { isDefault: true } });
}

export const declarationService = {
  /** Default first, then newest. */
  async list() {
    return prisma.declarationProfile.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  },

  /** The declaration a new invoice starts from. */
  async getDefault() {
    return prisma.declarationProfile.findFirst({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
  },

  /** The first profile created becomes the default automatically. */
  async create(dto: DeclarationProfileDto) {
    const count = await prisma.declarationProfile.count();
    return prisma.declarationProfile.create({ data: { ...fields(dto), isDefault: count === 0 } });
  },

  async update(id: string, dto: DeclarationProfileDto) {
    await getOrThrow(id);
    return prisma.declarationProfile.update({ where: { id }, data: fields(dto) });
  },

  async setDefault(id: string) {
    const target = await getOrThrow(id);
    if (!target.isActive) throw new AppError('Make this declaration active before choosing it as the default', 400, 'DECLARATION_PROFILE_INACTIVE');
    const [, profile] = await prisma.$transaction([
      prisma.declarationProfile.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } }),
      prisma.declarationProfile.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return profile;
  },

  /** "Not needed" declarations stay saved but are not offered on new invoices; an inactive declaration is never the default. */
  async setActive(id: string, isActive: boolean) {
    const profile = await getOrThrow(id);
    const updated = await prisma.declarationProfile.update({ where: { id }, data: { isActive, ...(isActive ? {} : { isDefault: false }) } });
    if (!isActive && profile.isDefault) await promoteNext();
    return updated;
  },

  /** Invoices keep their own copy, so deleting a profile never changes them. */
  async remove(id: string) {
    const profile = await getOrThrow(id);
    await prisma.declarationProfile.delete({ where: { id } });
    if (profile.isDefault) await promoteNext();
  },
};
