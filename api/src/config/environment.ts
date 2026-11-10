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

  return {
    ...environment,
    PORT: port,
    HOST: host.trim(),
    CORS_ORIGINS: origins,
    GENIUS_TIMEOUT_MS: timeout,
  };
}
