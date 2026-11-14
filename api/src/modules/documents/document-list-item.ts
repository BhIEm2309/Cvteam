import { DocumentType } from '@prisma/client';
import { AnalysisStatus } from '../extraction/extraction-queue';

// Forma de cada documento que devuelve la API al frontend.
export interface DocumentListItem {
  id: string;
  title: string;
  type: DocumentType;
  fileName: string;
  sizeBytes: number;
  versionNumber: number;
  createdAt: Date;
  // Estado del último análisis con IA. PENDING_ANALYSIS = nunca se analizó (por ejemplo, perfiles de cargo).
  analysisStatus: AnalysisStatus;
  // Mensaje del error si el último análisis falló; si no, null.
  analysisError: string | null;
  // Código del error (por ejemplo IA_RECHAZO) si el último análisis falló; si no, null.
  analysisErrorCode: string | null;
  // Competencias propuestas por la IA que todavía nadie revisa.
  pendingProposals: number;
}
