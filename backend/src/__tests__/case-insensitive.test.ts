import { anyOfCi, ci, containsCi } from '../utils/caseInsensitive';

describe('case-insensitive filters (PostgreSQL compares text exactly)', () => {
  it('equals ignores capitals', () => {
    expect(ci('Banana')).toEqual({ equals: 'Banana', mode: 'insensitive' });
  });

  it('contains ignores capitals', () => {
    expect(containsCi('kj')).toEqual({ contains: 'kj', mode: 'insensitive' });
  });

  it('"any of these" becomes one insensitive match per value', () => {
    expect(anyOfCi('portOfLoading', ['BOM', 'yul'])).toEqual({
      OR: [{ portOfLoading: { equals: 'BOM', mode: 'insensitive' } }, { portOfLoading: { equals: 'yul', mode: 'insensitive' } }],
    });
  });
});
