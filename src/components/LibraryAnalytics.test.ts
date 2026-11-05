import { describe, expect, it } from 'vitest';
import {
  formatMoney,
  getBuckets,
  inRange,
  rangeBounds,
  safeDateDifference,
  safeNumber,
} from './LibraryAnalytics';

describe('analytics date ranges', () => {
  it('includes today and excludes the next day', () => {
    const bounds = rangeBounds('today');
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    expect(inRange(todayKey, bounds)).toBe(true);
    expect(inRange(tomorrowKey, bounds)).toBe(false);
  });

  it('creates seven consecutive daily buckets for the last seven days', () => {
    const bounds = rangeBounds('last7');
    const buckets = getBuckets('last7', bounds);

    expect(buckets).toHaveLength(7);
    expect(buckets[0].start).toBe(bounds.start);
    expect(buckets[6].end).toBe(bounds.end);
    expect(buckets.every((bucket, index) => index === 0 || buckets[index - 1].end === bucket.start)).toBe(true);
  });

  it('creates twelve monthly buckets for all-time trend display', () => {
    expect(getBuckets('all', rangeBounds('all'))).toHaveLength(12);
  });
});

describe('analytics safe formatting', () => {
  it('normalizes missing and invalid numeric values to zero', () => {
    expect(safeNumber(null)).toBe(0);
    expect(safeNumber('not-a-number')).toBe(0);
    expect(safeNumber('12.5')).toBe(12.5);
  });

  it('returns only valid non-negative borrowing durations', () => {
    expect(safeDateDifference('2026-03-04', '2026-03-06')).toBe(2);
    expect(safeDateDifference('2026-03-06', '2026-03-04')).toBeNull();
    expect(safeDateDifference('2026-03-04', null)).toBeNull();
  });

  it('formats invalid currency values without exposing NaN', () => {
    expect(formatMoney(Number.NaN)).not.toContain('NaN');
  });
});
