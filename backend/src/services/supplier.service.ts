import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import type { SupplierDto } from 'shared';
import { ci } from '../utils/caseInsensitive';

const template = (value: SupplierDto['importTemplate']) => (value ? (value as Prisma.InputJsonValue) : Prisma.DbNull);

export const supplierService = {
  /** Suppliers by name, with how many purchase invoices each has. */
  async list() {
    return prisma.supplier.findMany({
      where: { deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { purchases: { where: { deletedAt: null } } } } },
    });
  },

  async getById(id: string) {
    const supplier = await prisma.supplier.findFirst({ where: { id, deletedAt: null } });
    if (!supplier) throw new AppError('Supplier not found', 404, 'SUPPLIER_NOT_FOUND');
    return supplier;
  },

  async create(dto: SupplierDto) {
    await this.assertNameFree(dto.name);
    return prisma.supplier.create({
      data: {
        name: dto.name,
        contact: dto.contact ?? null, phone: dto.phone ?? null, email: dto.email ?? null, address: dto.address ?? null, gstin: dto.gstin ?? null,
        importTemplate: template(dto.importTemplate),
        isActive: dto.isActive ?? true,
      },
    });
  },

  async update(id: string, dto: SupplierDto) {
    await this.getById(id);
    await this.assertNameFree(dto.name, id);
    return prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        contact: dto.contact ?? null, phone: dto.phone ?? null, email: dto.email ?? null, address: dto.address ?? null, gstin: dto.gstin ?? null,
        importTemplate: template(dto.importTemplate),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  },

  async setActive(id: string, isActive: boolean) {
    await this.getById(id);
    return prisma.supplier.update({ where: { id }, data: { isActive } });
  },

  /** A supplier with purchase invoices is kept (mark it "not needed" instead): its records would lose their name. */
  async remove(id: string) {
    await this.getById(id);
    const used = await prisma.purchaseInvoice.count({ where: { supplierId: id, deletedAt: null } });
    if (used > 0) throw new AppError(`This supplier has ${used} purchase invoice${used === 1 ? '' : 's'}. Mark it as not needed instead of deleting it.`, 409, 'SUPPLIER_IN_USE');
    await prisma.supplier.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  async assertNameFree(name: string, exceptId?: string) {
    const clash = await prisma.supplier.findFirst({ where: { deletedAt: null, name: ci(name), ...(exceptId ? { NOT: { id: exceptId } } : {}) }, select: { id: true } });
    if (clash) throw new AppError('A supplier with this name already exists', 409, 'SUPPLIER_EXISTS');
  },
};
