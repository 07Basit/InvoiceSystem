import { prismaMock } from './setup';
import { signService } from '../services/sign.service';

const dto = { name: 'Proprietor sign', image: 'data:image/png;base64,AAAA' };
const row = (over: Record<string, unknown> = {}) => ({
  id: 'b1', isDefault: false, isActive: true, createdAt: new Date(), updatedAt: new Date(), ...dto, ...over,
});

describe('signService', () => {
  it('makes the first seal & sign the default, later ones not', async () => {
    prismaMock.signProfile.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    prismaMock.signProfile.create.mockResolvedValue(row() as never);
    await signService.create(dto);
    await signService.create(dto);
    expect(prismaMock.signProfile.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ isDefault: true }) });
    expect(prismaMock.signProfile.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ isDefault: false }) });
  });

  it('404s for a missing seal & sign and refuses an inactive default', async () => {
    prismaMock.signProfile.findUnique.mockResolvedValueOnce(null);
    await expect(signService.update('nope', dto)).rejects.toMatchObject({ statusCode: 404 });
    prismaMock.signProfile.findUnique.mockResolvedValueOnce(row({ isActive: false }) as never);
    await expect(signService.setDefault('b1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('setDefault clears the others', async () => {
    prismaMock.signProfile.findUnique.mockResolvedValue(row() as never);
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, row({ isDefault: true })] as never);
    await signService.setDefault('b1');
    expect(prismaMock.signProfile.updateMany).toHaveBeenCalledWith({ where: { isDefault: true, NOT: { id: 'b1' } }, data: { isDefault: false } });
  });

  it('marking the default as not needed clears it and promotes another active seal & sign', async () => {
    prismaMock.signProfile.findUnique.mockResolvedValue(row({ isDefault: true }) as never);
    prismaMock.signProfile.update.mockResolvedValue(row({ isActive: false }) as never);
    prismaMock.signProfile.findFirst.mockResolvedValue(row({ id: 'b2' }) as never);
    await signService.setActive('b1', false);
    expect(prismaMock.signProfile.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { isActive: false, isDefault: false } });
    expect(prismaMock.signProfile.update).toHaveBeenCalledWith({ where: { id: 'b2' }, data: { isDefault: true } });
  });

  it('deleting the default promotes another; deleting a normal one does not', async () => {
    prismaMock.signProfile.findUnique.mockResolvedValueOnce(row() as never);
    await signService.remove('b1');
    expect(prismaMock.signProfile.update).not.toHaveBeenCalled();
    prismaMock.signProfile.findUnique.mockResolvedValueOnce(row({ isDefault: true }) as never);
    prismaMock.signProfile.findFirst.mockResolvedValue(row({ id: 'b2' }) as never);
    await signService.remove('b1');
    expect(prismaMock.signProfile.update).toHaveBeenCalledWith({ where: { id: 'b2' }, data: { isDefault: true } });
  });
});
