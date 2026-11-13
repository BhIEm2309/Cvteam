import { Module } from '@nestjs/common';
import { ClaudeExtractionProvider } from './claude-extraction.provider';
import { ExtractionController } from './extraction.controller';
import { EXTRACTION_PROVIDER } from './extraction-provider';
import { ExtractionService } from './extraction.service';
import { ExtractionWorker } from './extraction.worker';

@Module({
  controllers: [ExtractionController],
  providers: [
    ExtractionService,
    ExtractionWorker,
    // Para cambiar de proveedor de IA basta con cambiar esta clase (debe cumplir ExtractionProvider).
    { provide: EXTRACTION_PROVIDER, useClass: ClaudeExtractionProvider },
  ],
})
export class ExtractionModule {}
