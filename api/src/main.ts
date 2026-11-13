import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from './config';
import { FileTooLargeFilter } from './common/file-too-large.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Todas las rutas empiezan con /api (por ejemplo /api/documents).
  app.setGlobalPrefix('api');

  // Mensaje en español cuando un archivo supera el tamaño máximo.
  app.useGlobalFilters(new FileTooLargeFilter());

  app.enableShutdownHooks();

  // Sin host explícito Node escucha en IPv4 e IPv6, así "localhost" funciona en cualquier equipo.
  await app.listen(config.port);
  Logger.log(`API escuchando en http://localhost:${config.port}/api`, 'Bootstrap');
}

void bootstrap();
