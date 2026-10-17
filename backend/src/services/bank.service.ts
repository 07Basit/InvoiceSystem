import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { BankProfileDto } from 'shared';

const fields = (dto: BankProfileDto) => ({
  bankName: dto.bankName,
  accountNumber: dto.accountNumber,
  ifscCode: dto.ifscCode || null,
  swiftCode: dto.swiftCode || null,
});

async function getOrThrow(id: string) {
  const profile = await prisma.bankProfile.findUnique({ where: { id } });
  if (!profile) throw new AppError('Bank profile not found', 404, 'BANK_PROFILE_NOT_FOUND');
  return profile;
}

/** After the default goes away, the most recently used active profile takes over. */
async function promoteNext() {
  const next = await prisma.bankProfile.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
  if (next) await prisma.bankProfile.update({ where: { id: next.id }, data: { isDefault: true } });
}

export const bankService = {
  /** Default first, then newest. */
  async list() {
    return prisma.bankProfile.findMany({ orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  },

  /** The account a new invoice starts from. */
  async getDefault() {
    return prisma.bankProfile.findFirst({ where: { isActive: true }, orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }] });
  },

  /** The first profile created becomes the default automatically. */
  async create(dto: BankProfileDto) {
    const count = await prisma.bankProfile.count();
    return prisma.bankProfile.create({ data: { ...fields(dto), isDefault: count === 0 } });
  },

  async update(id: string, dto: BankProfileDto) {
    await getOrThrow(id);
    return prisma.bankProfile.update({ where: { id }, data: fields(dto) });
  },

  async setDefault(id: string) {
    const target = await getOrThrow(id);
    if (!target.isActive) throw new AppError('Make this account active before choosing it as the default', 400, 'BANK_PROFILE_INACTIVE');
    const [, profile] = await prisma.$transaction([
      prisma.bankProfile.updateMany({ where: { isDefault: true, NOT: { id } }, data: { isDefault: false } }),
      prisma.bankProfile.update({ where: { id }, data: { isDefault: true } }),
    ]);
    return profile;
  },

  /** "Not needed" accounts stay saved but are not offered on new invoices; an inactive account is never the default. */
  async setActive(id: string, isActive: boolean) {
    const profile = await getOrThrow(id);
    const updated = await prisma.bankProfile.update({ where: { id }, data: { isActive, ...(isActive ? {} : { isDefault: false }) } });
    if (!isActive && profile.isDefault) await promoteNext();
    return updated;
  },

  /** Invoices keep their own copy, so deleting a profile never changes them. */
  async remove(id: string) {
    const profile = await getOrThrow(id);
    await prisma.bankProfile.delete({ where: { id } });
    if (profile.isDefault) await promoteNext();
  },
};
