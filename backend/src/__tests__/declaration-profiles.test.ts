import { prismaMock } from './setup';
import { declarationService } from '../services/declaration.service';

const dto = { name: 'Standard', text: 'We declare that this invoice shows the actual price.' };
const row = (over: Record<string, unknown> = {}) => ({
  id: 'b1', isDefault: false, isActive: true, createdAt: new Date(), updatedAt: new Date(), ...dto, ...over,
});

describe('declarationService', () => {
  it('makes the first declaration the default, later ones not', async () => {
    prismaMock.declarationProfile.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    prismaMock.declarationProfile.create.mockResolvedValue(row() as never);
    await declarationService.create(dto);
    await declarationService.create(dto);
    expect(prismaMock.declarationProfile.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ isDefault: true }) });
    expect(prismaMock.declarationProfile.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ isDefault: false }) });
  });

  it('404s for a missing declaration and refuses an inactive default', async () => {
    prismaMock.declarationProfile.findUnique.mockResolvedValueOnce(null);
    await expect(declarationService.update('nope', dto)).rejects.toMatchObject({ statusCode: 404 });
    prismaMock.declarationProfile.findUnique.mockResolvedValueOnce(row({ isActive: false }) as never);
    await expect(declarationService.setDefault('b1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('setDefault clears the others', async () => {
    prismaMock.declarationProfile.findUnique.mockResolvedValue(row() as never);
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, row({ isDefault: true })] as never);
    await declarationService.setDefault('b1');
    expect(prismaMock.declarationProfile.updateMany).toHaveBeenCalledWith({ where: { isDefault: true, NOT: { id: 'b1' } }, data: { isDefault: false } });
  });

  it('marking the default as not needed clears it and promotes another active declaration', async () => {
    prismaMock.declarationProfile.findUnique.mockResolvedValue(row({ isDefault: true }) as never);
    prismaMock.declarationProfile.update.mockResolvedValue(row({ isActive: false }) as never);
    prismaMock.declarationProfile.findFirst.mockResolvedValue(row({ id: 'b2' }) as never);
    await declarationService.setActive('b1', false);
    expect(prismaMock.declarationProfile.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { isActive: false, isDefault: false } });
    expect(prismaMock.declarationProfile.update).toHaveBeenCalledWith({ where: { id: 'b2' }, data: { isDefault: true } });
  });

  it('deleting the default promotes another; deleting a normal one does not', async () => {
    prismaMock.declarationProfile.findUnique.mockResolvedValueOnce(row() as never);
    await declarationService.remove('b1');
    expect(prismaMock.declarationProfile.update).not.toHaveBeenCalled();
    prismaMock.declarationProfile.findUnique.mockResolvedValueOnce(row({ isDefault: true }) as never);
    prismaMock.declarationProfile.findFirst.mockResolvedValue(row({ id: 'b2' }) as never);
    await declarationService.remove('b1');
    expect(prismaMock.declarationProfile.update).toHaveBeenCalledWith({ where: { id: 'b2' }, data: { isDefault: true } });
  });
});
