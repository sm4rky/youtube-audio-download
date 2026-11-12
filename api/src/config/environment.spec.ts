import { describe, expect, it } from '@jest/globals';
import { validateEnvironment } from './environment';

describe('environment configuration', () => {
  it('uses local defaults without requiring a Genius token', () => {
    expect(validateEnvironment({})).toEqual({
      PORT: 3001,
      HOST: '127.0.0.1',
      CORS_ORIGINS: ['http://localhost:5173'],
      GENIUS_TIMEOUT_MS: 8000,
      LRCLIB_TIMEOUT_MS: 8000,
      LRCLIB_CLIENT_NAME: 'AudioMint',
      LRCLIB_CLIENT_VERSION: '0.1.0',
      LRCLIB_CLIENT_CONTACT: '',
    });
  });

  it('normalizes port, host, and comma-separated origins', () => {
    expect(
      validateEnvironment({
        PORT: '65535',
        HOST: ' 0.0.0.0 ',
        CORS_ORIGINS: ' http://localhost:5173, ,chrome-extension://example, ',
      }),
    ).toEqual({
      PORT: 65535,
      HOST: '0.0.0.0',
      CORS_ORIGINS: ['http://localhost:5173', 'chrome-extension://example'],
      GENIUS_TIMEOUT_MS: 8000,
      LRCLIB_TIMEOUT_MS: 8000,
      LRCLIB_CLIENT_NAME: 'AudioMint',
      LRCLIB_CLIENT_VERSION: '0.1.0',
      LRCLIB_CLIENT_CONTACT: '',
    });
  });

  it.each(['', ' ', 'abc', '3001.5', '0', '-1', '65536', Infinity])(
    'rejects invalid PORT %s',
    (PORT) => {
      expect(() => validateEnvironment({ PORT })).toThrow(
        'PORT must be an integer between 1 and 65535.',
      );
    },
  );

  it('rejects wildcard origins', () => {
    expect(() => validateEnvironment({ CORS_ORIGINS: '*' })).toThrow(
      'without wildcards',
    );
  });

  it('normalizes a configured Genius timeout', () => {
    expect(
      validateEnvironment({ GENIUS_TIMEOUT_MS: '12000' }).GENIUS_TIMEOUT_MS,
    ).toBe(12000);
  });

  it.each(['', ' ', 'abc', '0', '-1', '30001', '1.5', Infinity, true, [1]])(
    'rejects invalid LRCLIB timeout %#',
    (LRCLIB_TIMEOUT_MS) => {
      expect(() => validateEnvironment({ LRCLIB_TIMEOUT_MS })).toThrow(
        'LRCLIB_TIMEOUT_MS',
      );
    },
  );

  it('validates and normalizes LRCLIB configuration', () => {
    expect(
      validateEnvironment({
        LRCLIB_TIMEOUT_MS: '12000',
        LRCLIB_CLIENT_NAME: 'AudioMint',
        LRCLIB_CLIENT_VERSION: '0.2.0',
        LRCLIB_CLIENT_CONTACT: 'contact@example.com',
      }),
    ).toMatchObject({
      LRCLIB_TIMEOUT_MS: 12000,
      LRCLIB_CLIENT_CONTACT: 'contact@example.com',
    });
  });

  it.each([
    { LRCLIB_CLIENT_NAME: '' },
    { LRCLIB_CLIENT_NAME: 'app\r\nHeader' },
    { LRCLIB_CLIENT_VERSION: '' },
    { LRCLIB_CLIENT_CONTACT: 'not a contact' },
    { LRCLIB_CLIENT_CONTACT: 'https://user:secret@example.com' },
    { LRCLIB_CLIENT_CONTACT: 'contact@example.com\r\nHeader: value' },
  ])('rejects invalid client identification %#', (input) => {
    expect(() => validateEnvironment(input)).toThrow('LRCLIB_CLIENT_');
  });

  it.each(['', ' ', 'abc', '1.5', '0', '-1', '30001', Infinity])(
    'rejects invalid Genius timeout %s',
    (GENIUS_TIMEOUT_MS) => {
      expect(() => validateEnvironment({ GENIUS_TIMEOUT_MS })).toThrow(
        'GENIUS_TIMEOUT_MS must be an integer between 1 and 30000.',
      );
    },
  );
});
