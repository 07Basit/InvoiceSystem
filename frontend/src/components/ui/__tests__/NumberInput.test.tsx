import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NumberInput, { sanitizeNumber } from '../NumberInput';
import { formatNumber } from '@/lib/format';

function Harness(props: { integer?: boolean; allowNegative?: boolean; initial?: number | undefined }) {
  const [value, setValue] = useState<number | undefined>(props.initial);
  return (
    <>
      <NumberInput ariaLabel="Amount" value={value} onChange={setValue} {...(props.integer ? { integer: true } : {})} {...(props.allowNegative ? { allowNegative: true } : {})} />
      <output data-testid="value">{String(value)}</output>
    </>
  );
}

describe('sanitizeNumber', () => {
  it('drops letters and a minus, keeps one decimal point', () => {
    expect(sanitizeNumber('-5a.5.5')).toBe('5.55');
    expect(sanitizeNumber('1.23456', { decimals: 2 })).toBe('1.23');
  });
  it('keeps only digits for whole numbers', () => {
    expect(sanitizeNumber('3.7', { integer: true })).toBe('37');
  });
  it('keeps a leading minus only when allowed', () => {
    expect(sanitizeNumber('-2.5', { allowNegative: true })).toBe('-2.5');
    expect(sanitizeNumber('-2.5')).toBe('2.5');
  });
});

describe('NumberInput', () => {
  it('starts empty for 0 and typing 5 gives 5, not 05', async () => {
    render(<Harness initial={0} />);
    const box = screen.getByLabelText('Amount');
    expect(box).toHaveValue('');
    await userEvent.type(box, '5');
    expect(box).toHaveValue('5');
    expect(screen.getByTestId('value')).toHaveTextContent('5');
  });

  it('lets you type 0.5 and refuses a minus sign', async () => {
    render(<Harness />);
    const box = screen.getByLabelText('Amount');
    await userEvent.type(box, '-0.5');
    expect(box).toHaveValue('0.5');
    expect(screen.getByTestId('value')).toHaveTextContent('0.5');
  });

  it('whole-number boxes ignore the decimal point', async () => {
    render(<Harness integer />);
    await userEvent.type(screen.getByLabelText('Amount'), '2.5');
    expect(screen.getByLabelText('Amount')).toHaveValue('25');
  });

  it('accepts a minus when allowed, and clearing gives undefined', async () => {
    render(<Harness allowNegative />);
    const box = screen.getByLabelText('Amount');
    await userEvent.type(box, '-0.4');
    expect(screen.getByTestId('value')).toHaveTextContent('-0.4');
    await userEvent.clear(box);
    expect(screen.getByTestId('value')).toHaveTextContent('undefined');
  });
});

describe('formatNumber', () => {
  it('adds thousands separators and two decimals', () => {
    expect(formatNumber(12345.6)).toBe('12,345.60');
    expect(formatNumber(0)).toBe('0.00');
    expect(formatNumber(1234567.891)).toBe('1,234,567.89');
  });
});
