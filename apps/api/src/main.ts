import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import { resolveCorsOrigin } from './config/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);

  app.enableCors({
    origin: resolveCorsOrigin(),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const redisIoAdapter = new RedisIoAdapter(app);
  await redisIoAdapter.connect(config.get<string>('redis.url')!);
  app.useWebSocketAdapter(redisIoAdapter);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SyncPlay API')
    .setDescription(
      'REST + realtime API for SyncPlay — account auth, device linking, and the ' +
        'contracts consumed by the Socket.IO sync/voice gateways. See docs/SOCKET_EVENTS.md ' +
        'for the realtime event contract, which is not expressible in OpenAPI.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get('port') ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`SyncPlay API listening on :${port} (docs at /docs)`);
}

bootstrap();
