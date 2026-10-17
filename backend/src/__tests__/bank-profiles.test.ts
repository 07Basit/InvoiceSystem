import { prismaMock } from './setup';
import { bankService } from '../services/bank.service';

const dto = { bankName: 'HDFC BANK', accountNumber: '5036834342323' };
const row = (over: Record<string, unknown> = {}) => ({
  id: 'b1', ifscCode: null, swiftCode: null, isDefault: false, isActive: true, createdAt: new Date(), updatedAt: new Date(), ...dto, ...over,
});

describe('bankService', () => {
  it('makes the first account the default, later ones not', async () => {
    prismaMock.bankProfile.count.mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    prismaMock.bankProfile.create.mockResolvedValue(row() as never);
    await bankService.create(dto);
    await bankService.create(dto);
    expect(prismaMock.bankProfile.create).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({ isDefault: true }) });
    expect(prismaMock.bankProfile.create).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({ isDefault: false }) });
  });

  it('stores empty IFSC/SWIFT as null', async () => {
    prismaMock.bankProfile.count.mockResolvedValue(1);
    prismaMock.bankProfile.create.mockResolvedValue(row() as never);
    await bankService.create({ ...dto, ifscCode: '', swiftCode: '' });
    expect(prismaMock.bankProfile.create).toHaveBeenCalledWith({ data: expect.objectContaining({ ifscCode: null, swiftCode: null }) });
  });

  it('404s for a missing account and refuses an inactive default', async () => {
    prismaMock.bankProfile.findUnique.mockResolvedValueOnce(null);
    await expect(bankService.update('nope', dto)).rejects.toMatchObject({ statusCode: 404 });
    prismaMock.bankProfile.findUnique.mockResolvedValueOnce(row({ isActive: false }) as never);
    await expect(bankService.setDefault('b1')).rejects.toMatchObject({ statusCode: 400 });
  });

  it('setDefault clears the others', async () => {
    prismaMock.bankProfile.findUnique.mockResolvedValue(row() as never);
    prismaMock.$transaction.mockResolvedValue([{ count: 1 }, row({ isDefault: true })] as never);
    await bankService.setDefault('b1');
    expect(prismaMock.bankProfile.updateMany).toHaveBeenCalledWith({ where: { isDefault: true, NOT: { id: 'b1' } }, data: { isDefault: false } });
  });

  it('marking the default as not needed clears it and promotes another active account', async () => {
    prismaMock.bankProfile.findUnique.mockResolvedValue(row({ isDefault: true }) as never);
    prismaMock.bankProfile.update.mockResolvedValue(row({ isActive: false }) as never);
    prismaMock.bankProfile.findFirst.mockResolvedValue(row({ id: 'b2' }) as never);
    await bankService.setActive('b1', false);
    expect(prismaMock.bankProfile.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { isActive: false, isDefault: false } });
    expect(prismaMock.bankProfile.update).toHaveBeenCalledWith({ where: { id: 'b2' }, data: { isDefault: true } });
  });

  it('deleting the default promotes another; deleting a normal one does not', async () => {
    prismaMock.bankProfile.findUnique.mockResolvedValueOnce(row() as never);
    await bankService.remove('b1');
    expect(prismaMock.bankProfile.update).not.toHaveBeenCalled();
    prismaMock.bankProfile.findUnique.mockResolvedValueOnce(row({ isDefault: true }) as never);
    prismaMock.bankProfile.findFirst.mockResolvedValue(row({ id: 'b2' }) as never);
    await bankService.remove('b1');
    expect(prismaMock.bankProfile.update).toHaveBeenCalledWith({ where: { id: 'b2' }, data: { isDefault: true } });
  });
});
