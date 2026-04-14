import { describe, it, expect } from 'vitest';
import pako from 'pako';
import { decodePRK, isPRKFormat, type PRKPayload } from '@/lib/tinkerprofiles/prk-decoder';

/** Helper: encode a payload the same way the server does (deflateRaw + base64) */
function encodePRK(payload: PRKPayload): string {
  const json = JSON.stringify(payload);
  const jsonBytes = new TextEncoder().encode(json);
  const compressed = pako.deflateRaw(jsonBytes);
  const base64 = btoa(String.fromCharCode(...compressed));
  return `PRK1:${base64}`;
}

const SAMPLE_PAYLOAD: PRKPayload = {
  n: 'TestChar',
  l: 220,
  p: 4,
  b: 1,
  f: 2,
  al: 30,
  s: { '16': 472, '17': 480, '152': 2001 },
  e: [{ sl: 6, id: 267896, ql: 300 }],
  a: [{ sl: 2, id: 123456, ql: 300 }],
  i: [{ sl: 1, id: 345678, ql: 300 }],
  pk: [12345, 67890],
  na: [98765],
};

describe('PRK Decoder', () => {
  describe('isPRKFormat', () => {
    it('detects PRK1: prefix', () => {
      expect(isPRKFormat('PRK1:abc123')).toBe(true);
    });

    it('detects PRK1: prefix with leading whitespace', () => {
      expect(isPRKFormat('  PRK1:abc123')).toBe(true);
    });

    it('rejects non-PRK strings', () => {
      expect(isPRKFormat('{"Character":{}}')).toBe(false);
      expect(isPRKFormat('')).toBe(false);
    });
  });

  describe('decodePRK', () => {
    it('roundtrips a payload through encode/decode', () => {
      const encoded = encodePRK(SAMPLE_PAYLOAD);
      const decoded = decodePRK(encoded);

      expect(decoded.n).toBe('TestChar');
      expect(decoded.l).toBe(220);
      expect(decoded.p).toBe(4);
      expect(decoded.b).toBe(1);
      expect(decoded.f).toBe(2);
      expect(decoded.al).toBe(30);
      expect(decoded.s['16']).toBe(472);
      expect(decoded.s['17']).toBe(480);
      expect(decoded.e).toHaveLength(1);
      expect(decoded.e[0].id).toBe(267896);
      expect(decoded.pk).toEqual([12345, 67890]);
      expect(decoded.na).toEqual([98765]);
    });

    it('throws on missing prefix', () => {
      expect(() => decodePRK('INVALID:abc')).toThrow('missing PRK1: prefix');
    });

    it('throws on invalid base64', () => {
      expect(() => decodePRK('PRK1:not-valid-base64!!!')).toThrow();
    });

    it('handles trailing whitespace', () => {
      const encoded = encodePRK(SAMPLE_PAYLOAD);
      const decoded = decodePRK(encoded + '\n  ');
      expect(decoded.n).toBe('TestChar');
    });
  });
});
