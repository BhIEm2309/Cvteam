import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { CommonModule } from './common/common.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    // Infraestructura compartida
    PrismaModule,
    StorageModule,
    CommonModule,

    // Módulos de negocio (agregar aquí cada módulo nuevo)
    DocumentsModule,
    DepartmentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
