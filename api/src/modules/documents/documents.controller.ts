import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { config } from '../../config';
import { DocumentsService } from './documents.service';

// Rutas del módulo de documentos. El controlador solo recibe la solicitud
// y llama al servicio; la lógica está en documents.service.ts.
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // GET /api/documents
  @Get()
  listDocuments() {
    return this.documentsService.listDocuments();
  }

  // GET /api/documents/:id/file
  // Devuelve el PDF para verlo en el navegador.
  // ParseUUIDPipe responde 400 si el id no tiene formato de UUID.
  @Get(':id/file')
  async getDocumentFile(
    @Param('id', new ParseUUIDPipe({ exceptionFactory: () => new BadRequestException('El id del documento no es válido.') }))
    id: string,
  ) {
    const file = await this.documentsService.getDocumentFile(id);

    return new StreamableFile(file.stream, {
      type: file.mimeType,
      length: file.sizeBytes,
      // "inline": el navegador lo muestra en vez de descargarlo. encodeURIComponent permite tildes en el nombre.
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    });
  }

  // POST /api/documents
  // Formulario multipart con:
  //   file: el archivo PDF (obligatorio)
  //   type: CV, JOB_PROFILE o SUPPORTING (opcional, por defecto CV)
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: config.maxUploadBytes, files: 1 },
      // Permite nombres de archivo con tildes y ñ.
      defParamCharset: 'utf8',
    }),
  )
  uploadDocument(@UploadedFile() file: Express.Multer.File | undefined, @Body('type') type: string | undefined) {
    return this.documentsService.uploadDocument(file, type);
  }
}
