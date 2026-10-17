import { prismaMock } from './setup';
import { exporterService } from '../services/exporter.service';

const dto = { name: 'Green Harvest', address: '1 Dock Rd', contact: '+91 90000 10000' };
const row = (over: Record<string, unknown> = {}) => ({
  id: 'e1', email: null, isDefault: false, isActive: true, createdAt: new Date(), updatedAt: new Date(), ...dto, ...over,
});

describe('exporterService', () => {
  it('makes the first profile the default', async () => {
    prismaMock.exporterProfile.count.mockResolvedValue(0);
    prismaMock.exporterProfile.create.mockResolvedValue(row({ isDefault: true }) as never);
    await exporterService.create(dto);
    expect(prismaMock.exporterProfile.create).toHaveBeenCalledWith({ data: expect.objectContaining({ isDefault: true }) });
  });

  it('does not make later profiles the default', async () => {
    prismaMock.exporterProfile.count.mockResolvedValue(2);
    prismaMock.exporterProfile.create.mockResolvedValue(row() as never);
    await exporterService.create(dto);
    expect(prismaMock.exporterProfile.create).toHaveBeenCalledWith({ data: expect.objectContaining({ isDefault: false }) });
  });

  it('refuses to make an inactive profile the default', async () => {
    prismaMock.exporterProfile.findUnique.mockResolvedValue(row({ isActive: false }) as never);
    await expect(exporterService.setDefault('e1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('deactivating the default clears it and promotes an active profile', async () => {
    prismaMock.exporterProfile.findUnique.mockResolvedValue(row({ isDefault: true }) as never);
    prismaMock.exporterProfile.update.mockResolvedValue(row({ isActive: false }) as never);
    prismaMock.exporterProfile.findFirst.mockResolvedValue(row({ id: 'e2' }) as never);
    await exporterService.setActive('e1', false);
    expect(prismaMock.exporterProfile.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { isActive: false, isDefault: false } });
    expect(prismaMock.exporterProfile.findFirst).toHaveBeenCalledWith({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
    expect(prismaMock.exporterProfile.update).toHaveBeenCalledWith({ where: { id: 'e2' }, data: { isDefault: true } });
  });

  it('404s when updating or defaulting a missing profile', async () => {
    prismaMock.exporterProfile.findUnique.mockResolvedValue(null);
    await expect(exporterService.update('nope', dto)).rejects.toMatchObject({ statusCode: 404 });
    await expect(exporterService.setDefault('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('setDefault clears the flag on the others and sets it on the chosen one', async () => {
    prismaMock.exporterProfile.findUnique.mockResolvedValue(row() as never);
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, row({ isDefault: true })] as never);
    const result = await exporterService.setDefault('e1');
    expect(prismaMock.exporterProfile.updateMany).toHaveBeenCalledWith({ where: { isDefault: true, NOT: { id: 'e1' } }, data: { isDefault: false } });
    expect(result.isDefault).toBe(true);
  });

  it('promotes another profile when the default is deleted', async () => {
    prismaMock.exporterProfile.findUnique.mockResolvedValue(row({ isDefault: true }) as never);
    prismaMock.exporterProfile.findFirst.mockResolvedValue(row({ id: 'e2' }) as never);
    await exporterService.remove('e1');
    expect(prismaMock.exporterProfile.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
    expect(prismaMock.exporterProfile.update).toHaveBeenCalledWith({ where: { id: 'e2' }, data: { isDefault: true } });
  });

  it('does not promote anything when a non-default profile is deleted', async () => {
    prismaMock.exporterProfile.findUnique.mockResolvedValue(row() as never);
    await exporterService.remove('e1');
    expect(prismaMock.exporterProfile.update).not.toHaveBeenCalled();
  });
});
