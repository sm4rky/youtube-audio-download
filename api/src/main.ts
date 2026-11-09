import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  try {
    const { port, host } = configureApp(app);
    await app.listen(port, host);
  } catch (error) {
    await app.close();
    throw error;
  }
}
void bootstrap().catch(() => {
  // Avoid logging arbitrary error objects that may contain environment secrets.
  Logger.error(
    'API bootstrap failed. Check configuration and port availability.',
    'Bootstrap',
  );
  process.exitCode = 1;
});
