import { ArgumentsHost, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import { Response } from 'express';
import { config } from '../config';

/**
 * Cuando un archivo supera el tamaño máximo, NestJS responde "File too large" (en inglés).
 * Este filtro cambia ese mensaje por uno en español para mostrarlo en la interfaz.
 */
@Catch(PayloadTooLargeException)
export class FileTooLargeFilter implements ExceptionFilter {
  catch(exception: PayloadTooLargeException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    response.status(413).json({
      statusCode: 413,
      error: 'Payload Too Large',
      message: `El archivo supera el tamaño máximo de ${config.maxUploadMb} MB.`,
    });
  }
}
