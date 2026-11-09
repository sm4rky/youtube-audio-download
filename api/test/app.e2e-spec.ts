import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './../src/app.module';
import { configureApp } from '../src/configure-app';
import { validateEnvironment } from '../src/config/environment';

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService(validateEnvironment({ GENIUS_ACCESS_TOKEN: '' })),
      )
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    configureApp(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it('/api/v1 (GET) preserves the starter endpoint', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1' });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe('Hello World!');
  });

  it('/api/v1/health works without a Genius token', async () => {
    expect(app.get(ConfigService).get('GENIUS_ACCESS_TOKEN')).toBe('');
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'youtube-audio-api',
    });
  });

  it('does not expose health outside the global prefix', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(404);
  });

  it('allows the development origin without credentials', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    expect(
      response.headers['access-control-allow-credentials'],
    ).toBeUndefined();
  });

  it('does not grant CORS access to an unlisted origin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'https://unlisted.example' },
    });
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  afterEach(async () => {
    await app?.close();
  });
});
