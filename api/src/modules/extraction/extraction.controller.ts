import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DocumentExtractionItem, ExtractionService } from './extraction.service';
import { parseReviewInput } from './proposal-review';
import { readRequestedModel } from './extraction-models';
import { ProposalReviewService, ReviewResult } from './proposal-review.service';

// Valida que el :id de la ruta sea un UUID; si no, responde 400 con un mensaje en español.
const documentIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('El id del documento no es válido.'),
});

// Análisis con IA de un documento. Las rutas cuelgan de /api/documents/:id.
@Controller('documents/:id/extraction')
export class ExtractionController {
  constructor(
    private readonly extraction: ExtractionService,
    private readonly review: ProposalReviewService,
  ) {}

  // Estado del análisis y competencias propuestas (pendientes de revisión humana).
  @Get()
  getExtraction(@Param('id', documentIdPipe) documentId: string): Promise<DocumentExtractionItem> {
    return this.extraction.getDocumentExtraction(documentId);
  }

  // Pide analizar el CV (la primera vez o después de un error). El análisis ocurre en segundo plano.
  // Cuerpo opcional: { "model": "claude-sonnet-5-5" } para usar el modelo alternativo solo en este CV
  // (solo con EXTRACTION_PROVIDER=claude; ver GET /api/extraction/settings).
  @Post()
  requestExtraction(@Param('id', documentIdPipe) documentId: string, @Body() body: unknown): Promise<DocumentExtractionItem> {
    return this.extraction.requestExtraction(documentId, readRequestedModel(body));
  }

  // Guarda la revisión humana de las competencias propuestas (confirmar o descartar), todo o nada.
  @Post('review')
  @HttpCode(200)
  reviewExtraction(@Param('id', documentIdPipe) documentId: string, @Body() body: unknown): Promise<ReviewResult> {
    return this.review.reviewDocument(documentId, parseReviewInput(body));
  }
}
