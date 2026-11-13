import { Global, Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';

// Almacenamiento de archivos, disponible en todos los módulos.
@Global()
@Module({
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class StorageModule {}
