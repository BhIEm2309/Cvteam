import { BadRequestException, Controller, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { config } from '../../config';
import { OrgChartImportService } from './org-chart-import.service';

// Rutas del importador de organigrama.
@Controller('org-chart')
export class OrgChartImportController {
  constructor(private readonly importService: OrgChartImportService) {}

  // POST /api/org-chart/import?mode=preview   → valida y muestra qué cambiaría, sin guardar
  // POST /api/org-chart/import?mode=apply     → guarda todo (o nada, si hay errores)
  // Formulario multipart con el campo "file" (CSV).
  @Post('import')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: config.maxUploadBytes, files: 1 },
      defParamCharset: 'utf8',
    }),
  )
  importOrgChart(@UploadedFile() file: Express.Multer.File | undefined, @Query('mode') mode: string | undefined) {
    if (mode !== 'preview' && mode !== 'apply') {
      throw new BadRequestException('Indica "mode=preview" (solo revisar) o "mode=apply" (guardar).');
    }
    return this.importService.importOrgChart(file, mode);
  }
}
