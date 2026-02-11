import { describe, it, expect } from 'vitest';
import { isKeyCompatible, getRecommendations } from './recommendations';

describe('Camelot compatibility', () => {
  it('matches same key', () => {
    expect(isKeyCompatible('8A', '8A')).toBe(true);
  });

  it('matches relative major/minor (A/B toggle)', () => {
    expect(isKeyCompatible('8A', '8B')).toBe(true);
    expect(isKeyCompatible('8B', '8A')).toBe(true);
  });

  it('matches adjacent numbers with wrap-around', () => {
    expect(isKeyCompatible('12A', '1A')).toBe(true);
    expect(isKeyCompatible('1B', '12B')).toBe(true);
  });

  it('rejects incompatible keys', () => {
    expect(isKeyCompatible('8A', '4A')).toBe(false);
  });
});

describe('recommendations', () => {
  it('filters by BPM tolerance when BPM exists', () => {
    const source = { id: 's', bpm: 120, key: '8A' };
    const library = [
      { id: 'a', bpm: 124, key: '8A' }, // ok
      { id: 'b', bpm: 130, key: '8A' }, // too far
      { id: 'c', bpm: 118, key: '7A' }, // ok (adjacent)
    ];

    const recs = getRecommendations(source, library, 5).map((x) => x.id);
    expect(recs).toContain('a');
    expect(recs).toContain('c');
    expect(recs).not.toContain('b');
  });
});

