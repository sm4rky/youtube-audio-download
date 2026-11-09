import { describe, expect, it } from '@jest/globals';
import { validateEnvironment } from './environment';

describe('environment configuration', () => {
  it('uses local defaults without requiring a Genius token', () => {
    expect(validateEnvironment({})).toEqual({
      PORT: 3001,
      HOST: '127.0.0.1',
      CORS_ORIGINS: ['http://localhost:5173'],
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
});
