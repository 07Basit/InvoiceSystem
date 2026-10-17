import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { SignProfileDto } from 'shared';

const fields = (dto: SignProfileDto) => ({ name: dto.name, image: dto.image });

async function getOrThrow(id: string) {
  const profile = await prisma.signProfile.findUnique({ where: { id } });
  if (!profile) throw new AppError('Sign profile not found', 404, 'SIGN_PROFILE_NOT_FOUND');
  return profile;
}

/** After the default goes away, the most recently used active profile takes over. */
async function promoteNext() {
  const next = await prisma.signProfile.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
  if (next) await prisma.signProfile.update({ where: { id: next.id }, data: { isDefault: true } });
}

export const signService = {
  /** Default first, then newest. */
  async list() {
    return prisma.signProfile.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  },

  /** The seal & sign a new invoice starts from. */
  async getDefault() {
    return prisma.signProfile.findFirst({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
  },

  /** The first profile created becomes the default automatically. */
  async create(dto: SignProfileDto) {
    const count = await prisma.signProfile.count();
    return prisma.signProfile.create({ data: { ...fields(dto), isDefault: count === 0 } });
  },

  async update(id: string, dto: SignProfileDto) {
    await getOrThrow(id);
    return prisma.signProfile.update({ where: { id }, data: fields(dto) });
  },

  async setDefault(id: string) {
    const target = await getOrThrow(id);
    if (!target.isActive) throw new AppError('Make this seal & sign active before choosing it as the default', 400, 'SIGN_PROFILE_INACTIVE');
    const [, profile] = await prisma.$transaction([
      prisma.signProfile.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } }),
      prisma.signProfile.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return profile;
  },

  /** "Not needed" seals & signs stay saved but are not offered on new invoices; an inactive seal & sign is never the default. */
  async setActive(id: string, isActive: boolean) {
    const profile = await getOrThrow(id);
    const updated = await prisma.signProfile.update({ where: { id }, data: { isActive, ...(isActive ? {} : { isDefault: false }) } });
    if (!isActive && profile.isDefault) await promoteNext();
    return updated;
  },

  /** Invoices keep their own copy, so deleting a profile never changes them. */
  async remove(id: string) {
    const profile = await getOrThrow(id);
    await prisma.signProfile.delete({ where: { id } });
    if (profile.isDefault) await promoteNext();
  },
};
