import { Module } from '@nestjs/common';
import { config } from '../../config';
import { ClaudeExtractionProvider } from './claude-extraction.provider';
import { GeminiExtractionProvider } from './gemini-extraction.provider';
import { ExtractionController } from './extraction.controller';
import { EXTRACTION_PROVIDER } from './extraction-provider';
import { ExtractionService } from './extraction.service';
import { ExtractionWorker } from './extraction.worker';
import { ProposalReviewService } from './proposal-review.service';

@Module({
  controllers: [ExtractionController],
  providers: [
    ExtractionService,
    ExtractionWorker,
    ProposalReviewService,
    // Proveedor de IA según EXTRACTION_PROVIDER (api/.env). Todos cumplen ExtractionProvider.
    {
      provide: EXTRACTION_PROVIDER,
      useFactory: () => (config.extraction.provider === 'claude' ? new ClaudeExtractionProvider() : new GeminiExtractionProvider()),
    },
  ],
})
export class ExtractionModule {}
