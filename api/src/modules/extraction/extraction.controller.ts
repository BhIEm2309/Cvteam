import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DocumentExtractionItem, ExtractionService } from './extraction.service';

// Valida que el :id de la ruta sea un UUID; si no, responde 400 con un mensaje en español.
const documentIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('El id del documento no es válido.'),
});

// Análisis con IA de un documento. Las rutas cuelgan de /api/documents/:id.
@Controller('documents/:id/extraction')
export class ExtractionController {
  constructor(private readonly extraction: ExtractionService) {}

  // Estado del análisis y competencias propuestas (pendientes de revisión humana).
  @Get()
  getExtraction(@Param('id', documentIdPipe) documentId: string): Promise<DocumentExtractionItem> {
    return this.extraction.getDocumentExtraction(documentId);
  }

  // Pide analizar el CV (la primera vez o después de un error). El análisis ocurre en segundo plano.
  @Post()
  requestExtraction(@Param('id', documentIdPipe) documentId: string): Promise<DocumentExtractionItem> {
    return this.extraction.requestExtraction(documentId);
  }
}
