import { DocumentType } from '@prisma/client';

// Forma de cada documento que devuelve la API al frontend.
export interface DocumentListItem {
  id: string;
  title: string;
  type: DocumentType;
  fileName: string;
  sizeBytes: number;
  versionNumber: number;
  createdAt: Date;
  // Mientras no exista el análisis con IA, todos los documentos quedan "PENDING_ANALYSIS".
  analysisStatus: 'PENDING_ANALYSIS';
}
