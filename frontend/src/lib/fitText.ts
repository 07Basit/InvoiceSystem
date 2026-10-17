/**
 * Font size that shrinks a one-line value just enough to fit its container, so long money amounts
 * (e.g. "₹25,673,487.03") are never cut off or sticking out of a small card.
 *
 * The container must be a CSS size container (`container-type: inline-size`) so `cqw` means "1% of its width".
 * The size is the largest of: maxRem, or the width divided by the text's estimated width in em, but never
 * below minRem. Browsers without container units ignore this and keep the element's normal size.
 *
 * `charWidthEm` is the average character width as a fraction of the font size; 0.58 is slightly wider than the
 * measured average for digits with commas, which leaves a small safety margin.
 */
export function fitFontSize(text: string, { maxRem = 1.5, minRem = 0.75, charWidthEm = 0.58 } = {}): string {
  const em = Math.max(text.length, 1) * charWidthEm;
  return `max(${minRem}rem, min(${maxRem}rem, calc(100cqw / ${em.toFixed(2)})))`;
}
