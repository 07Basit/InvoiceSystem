import { describe, expect, it } from 'vitest';
import { groupByAge } from '../groupByAge';
import type { Document } from '../../services/documentService';

const NOW = new Date('2026-10-24T15:00:00');
const doc = (id: string, updatedAt: string): Document => ({ id, title: id, type: 'WORD', size: 1, starred: false, createdAt: '2026-01-01T00:00:00', updatedAt });

describe('groupByAge', () => {
  it('sorts documents into Today, Within 7 days, Within 30 days and Older', () => {
    const groups = groupByAge([doc('today', '2026-10-24T09:00:00'), doc('last night', '2026-10-23T23:00:00'), doc('week', '2026-10-18T12:00:00'), doc('month', '2026-10-01T12:00:00'), doc('old', '2026-06-01T12:00:00')], NOW);
    expect(groups.map((g) => [g.label, g.documents.map((d) => d.id)])).toEqual([
      ['Today', ['today']],
      ['Within 7 days', ['last night', 'week']],
      ['Within 30 days', ['month']],
      ['Older', ['old']],
    ]);
  });

  it('leaves out groups with nothing in them and keeps the order it was given', () => {
    const groups = groupByAge([doc('b', '2026-10-20T12:00:00'), doc('a', '2026-10-19T12:00:00')], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.documents.map((d) => d.id)).toEqual(['b', 'a']);
    expect(groupByAge([], NOW)).toEqual([]);
  });
});
