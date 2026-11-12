export function validateEnvironment(environment: Record<string, unknown>) {
  const rawPort = environment.PORT ?? 3001;
  const port = typeof rawPort === 'string' ? Number(rawPort) : rawPort;
  if (
    typeof port !== 'number' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const host = environment.HOST ?? '127.0.0.1';
  if (typeof host !== 'string' || !host.trim()) {
    throw new Error('HOST must be a non-empty string.');
  }

  const rawOrigins = environment.CORS_ORIGINS ?? 'http://localhost:5173';
  if (typeof rawOrigins !== 'string') {
    throw new Error('CORS_ORIGINS must be a comma-separated list of origins.');
  }
  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.some((origin) => origin.includes('*'))) {
    throw new Error(
      'CORS_ORIGINS must contain explicit origins without wildcards.',
    );
  }

  const rawTimeout = environment.GENIUS_TIMEOUT_MS ?? 8000;
  const timeout =
    typeof rawTimeout === 'string' ? Number(rawTimeout) : rawTimeout;
  if (
    typeof timeout !== 'number' ||
    !Number.isInteger(timeout) ||
    timeout < 1 ||
    timeout > 30000
  ) {
    throw new Error(
      'GENIUS_TIMEOUT_MS must be an integer between 1 and 30000.',
    );
  }

  const rawLrclibTimeout = environment.LRCLIB_TIMEOUT_MS ?? 8000;
  const lrclibTimeout =
    typeof rawLrclibTimeout === 'string'
      ? Number(rawLrclibTimeout)
      : rawLrclibTimeout;
  if (
    typeof lrclibTimeout !== 'number' ||
    !Number.isInteger(lrclibTimeout) ||
    lrclibTimeout < 1 ||
    lrclibTimeout > 30000
  ) {
    throw new Error(
      'LRCLIB_TIMEOUT_MS must be an integer between 1 and 30000.',
    );
  }
  const clientName = environment.LRCLIB_CLIENT_NAME ?? 'AudioMint';
  const clientVersion = environment.LRCLIB_CLIENT_VERSION ?? '0.1.0';
  if (
    typeof clientName !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(clientName)
  ) {
    throw new Error(
      'LRCLIB_CLIENT_NAME must be a non-empty application identifier.',
    );
  }
  if (
    typeof clientVersion !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9.+_-]{0,31}$/.test(clientVersion)
  ) {
    throw new Error(
      'LRCLIB_CLIENT_VERSION must be a non-empty version identifier.',
    );
  }
  const clientContact = environment.LRCLIB_CLIENT_CONTACT ?? '';
  if (
    typeof clientContact !== 'string' ||
    (clientContact !== '' && !isClientContact(clientContact))
  ) {
    throw new Error(
      'LRCLIB_CLIENT_CONTACT must be an HTTPS project URL or contact email address.',
    );
  }

  return {
    ...environment,
    PORT: port,
    HOST: host.trim(),
    CORS_ORIGINS: origins,
    GENIUS_TIMEOUT_MS: timeout,
    LRCLIB_TIMEOUT_MS: lrclibTimeout,
    LRCLIB_CLIENT_NAME: clientName,
    LRCLIB_CLIENT_VERSION: clientVersion,
    LRCLIB_CLIENT_CONTACT: clientContact,
  };
}

function isClientContact(value: string): boolean {
  if (!/^[\x21-\x7e]{1,200}$/.test(value) || /[()]/.test(value)) return false;
  if (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value))
    return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
