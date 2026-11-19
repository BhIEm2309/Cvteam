import { Controller, Get } from '@nestjs/common';
import { ExtractionSettings, getExtractionSettings } from './extraction-settings';

// Configuración de la IA de análisis de CVs. Es la misma para todas las organizaciones (sale de api/.env),
// por eso no filtra por organización ni devuelve datos de ninguna.
@Controller('extraction')
export class ExtractionSettingsController {
  // Proveedor y modelo activos, y si hay modelo alternativo. La pantalla Ingesta lo usa para mostrar u ocultar
  // el botón "Analizar con ...". No incluye claves.
  @Get('settings')
  getSettings(): ExtractionSettings {
    return getExtractionSettings();
  }
}
