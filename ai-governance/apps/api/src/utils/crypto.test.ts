import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt } from './crypto.js';

const SECRET = 'test-secret-32-chars-minimum-ok!';

beforeEach(() => {
  process.env.SERVER_SECRET = SECRET;
});

describe('encrypt / decrypt', () => {
  it('round-trips a plain string', () => {
    const plain = 'hello world';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('round-trips an empty string', () => {
    expect(decrypt(encrypt(''))).toBe('');
  });

  it('round-trips unicode content', () => {
    const plain = '🔑 secret: こんにちは';
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('produces different ciphertext on every call (random IV)', () => {
    const plain = 'same input';
    const c1 = encrypt(plain);
    const c2 = encrypt(plain);
    expect(c1).not.toBe(c2);
  });

  it('ciphertext is valid base64', () => {
    const c = encrypt('test');
    expect(() => Buffer.from(c, 'base64')).not.toThrow();
  });

  it('throws when SERVER_SECRET is missing', () => {
    delete process.env.SERVER_SECRET;
    expect(() => encrypt('x')).toThrow('SERVER_SECRET');
  });

  it('throws on tampered ciphertext', () => {
    const c = encrypt('original');
    const buf = Buffer.from(c, 'base64');
    // Flip a byte in the ciphertext portion (after iv+tag = 28 bytes)
    buf[30] ^= 0xff;
    expect(() => decrypt(buf.toString('base64'))).toThrow();
  });

  it('throws on truncated ciphertext', () => {
    const c = encrypt('original');
    const truncated = c.slice(0, 10);
    expect(() => decrypt(truncated)).toThrow();
  });
});
