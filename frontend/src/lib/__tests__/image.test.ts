import { describe, expect, it } from 'vitest';
import { fitWithin, SIGN_MAX_FILE_BYTES, validateSignFile } from '../image';

describe('validateSignFile', () => {
  it('accepts PNG, JPEG and WebP under the size limit', () => {
    expect(validateSignFile({ type: 'image/png', size: 1000 })).toBeNull();
    expect(validateSignFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(validateSignFile({ type: 'image/webp', size: 1000 })).toBeNull();
  });

  it('rejects other types and oversized files', () => {
    expect(validateSignFile({ type: 'application/pdf', size: 1000 })).toMatch(/PNG, JPEG or WebP/);
    expect(validateSignFile({ type: 'image/gif', size: 1000 })).toMatch(/PNG, JPEG or WebP/);
    expect(validateSignFile({ type: 'image/png', size: SIGN_MAX_FILE_BYTES + 1 })).toMatch(/5 MB/);
  });
});

describe('fitWithin', () => {
  it('shrinks to fit the box keeping the proportions', () => {
    expect(fitWithin(1200, 480)).toEqual({ width: 600, height: 240 });
    expect(fitWithin(2400, 480)).toEqual({ width: 600, height: 120 });
    expect(fitWithin(600, 960)).toEqual({ width: 150, height: 240 });
  });

  it('never enlarges a small image', () => {
    expect(fitWithin(200, 80)).toEqual({ width: 200, height: 80 });
  });
});
