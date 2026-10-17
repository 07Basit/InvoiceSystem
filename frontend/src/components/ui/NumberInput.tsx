import { useEffect, useState } from 'react';

interface NumberInputProps {
  /** 0 or undefined shows an empty box with the placeholder. */
  value: number | undefined;
  /** Called with undefined when the box is cleared. */
  onChange: (value: number | undefined) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
  /** Whole numbers only (no decimal point). */
  integer?: boolean;
  /** Most digits after the decimal point. */
  decimals?: number;
  /** A leading minus is accepted (e.g. a round-off that reduces the total). */
  allowNegative?: boolean;
  hasError?: boolean;
}

/** Strips everything that can't be part of the number; no minus unless allowed. */
export function sanitizeNumber(raw: string, { integer = false, decimals = 2, allowNegative = false } = {}): string {
  let text = raw.replace(/,/g, '.');
  const negative = allowNegative && text.trim().startsWith('-');
  text = text.replace(integer ? /[^0-9]/g : /[^0-9.]/g, '');
  if (!integer) {
    const [whole = '', ...rest] = text.split('.');
    text = rest.length ? `${whole}.${rest.join('').slice(0, decimals)}` : whole;
  }
  return negative ? `-${text}` : text;
}

/** Text box for numbers: starts empty, never accepts a minus (unless asked), keeps what you type ("0.5", "1."). */
export default function NumberInput({ value, onChange, ariaLabel, placeholder = '0', className, integer, decimals = 2, allowNegative, hasError }: NumberInputProps) {
  const [text, setText] = useState(value ? String(value) : '');

  // follow outside changes (a "Round to whole" click, loading an invoice) but not our own typing
  useEffect(() => {
    const typed = text === '' || text === '-' || text === '.' ? 0 : Number(text);
    if (typed !== (value ?? 0)) setText(value ? String(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      inputMode={integer ? 'numeric' : 'decimal'}
      aria-label={ariaLabel}
      aria-invalid={hasError ? true : undefined}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const next = sanitizeNumber(e.target.value, { integer: !!integer, decimals, allowNegative: !!allowNegative });
        setText(next);
        const n = Number(next);
        onChange(next === '' || next === '-' || next === '.' || !Number.isFinite(n) ? undefined : n);
      }}
      className={className ?? 'input'}
    />
  );
}
