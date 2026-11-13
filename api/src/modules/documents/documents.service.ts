import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { FileStorageService } from '../../storage/file-storage.service';
import { CurrentOrganizationService } from '../../common/current-organization.service';
import { DocumentListItem } from './document-list-item';

// Tipos de documento que se pueden subir.
const ALLOWED_DOCUMENT_TYPES: DocumentType[] = ['CV', 'JOB_PROFILE', 'SUPPORTING'];

// Cantidad máxima de documentos que devuelve el listado.
const MAX_DOCUMENTS_IN_LIST = 100;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileStorage: FileStorageService,
    private readonly currentOrganization: CurrentOrganizationService,
  ) {}

  // Lista los documentos de la organización, del más reciente al más antiguo.
  async listDocuments(): Promise<DocumentListItem[]> {
    const organization = await this.currentOrganization.getCurrentOrganization();

    const documents = await this.prisma.document.findMany({
      where: {
        organizationId: organization.organizationId,
        archivedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_DOCUMENTS_IN_LIST,
      include: {
        // Solo la última versión de cada documento.
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    const result: DocumentListItem[] = [];
    for (const document of documents) {
      const latestVersion = document.versions[0];

      // Un documento sin versiones no debería existir; si pasa, no se muestra.
      if (latestVersion === undefined) {
        continue;
      }

      result.push({
        id: document.id,
        title: document.title,
        type: document.type,
        fileName: latestVersion.originalName,
        sizeBytes: Number(latestVersion.sizeBytes),
        versionNumber: latestVersion.versionNumber,
        createdAt: document.createdAt,
        analysisStatus: 'PENDING_ANALYSIS',
      });
    }

    return result;
  }

  // Sube un PDF: lo guarda en disco y lo registra en la base de datos.
  async uploadDocument(file: Express.Multer.File | undefined, typeText: string | undefined): Promise<DocumentListItem> {
    // 1. Validar los datos recibidos.
    const validFile = this.validatePdfFile(file);
    const documentType = this.parseDocumentType(typeText);

    // 2. Preparar los datos del documento.
    const organization = await this.currentOrganization.getCurrentOrganization();
    const documentId = randomUUID();
    const versionId = randomUUID();
    const storageKey = `${organization.organizationId}/${documentId}/${versionId}.pdf`;
    const sha256 = createHash('sha256').update(validFile.buffer).digest('hex');
    const fileName = validFile.originalname.slice(0, 255);
    const title = this.createTitleFromFileName(fileName);

    // 3. Guardar el archivo en disco.
    await this.fileStorage.saveFile(storageKey, validFile.buffer);

    // 4. Registrar el documento en la base de datos.
    //    Se usa una transacción: se guardan las tres filas o ninguna.
    try {
      const createdDocument = await this.prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            id: documentId,
            organizationId: organization.organizationId,
            title: title,
            type: documentType,
          },
        });

        await tx.documentVersion.create({
          data: {
            id: versionId,
            organizationId: organization.organizationId,
            documentId: documentId,
            versionNumber: 1,
            originalName: fileName,
            storageKey: storageKey,
            mimeType: 'application/pdf',
            sizeBytes: validFile.size,
            sha256: sha256,
            uploadStatus: 'STORED',
            uploadedByMemberId: organization.memberId,
            uploadedAt: new Date(),
          },
        });

        await tx.auditEvent.create({
          data: {
            organizationId: organization.organizationId,
            actorMemberId: organization.memberId,
            action: 'DOCUMENT_UPLOADED',
            entityType: 'Document',
            entityId: documentId,
            changes: {
              type: documentType,
              fileName: fileName,
              sizeBytes: validFile.size,
              sha256: sha256,
            },
          },
        });

        return document;
      });

      return {
        id: createdDocument.id,
        title: createdDocument.title,
        type: createdDocument.type,
        fileName: fileName,
        sizeBytes: validFile.size,
        versionNumber: 1,
        createdAt: createdDocument.createdAt,
        analysisStatus: 'PENDING_ANALYSIS',
      };
    } catch (error) {
      // Si falla la base de datos, se borra el archivo para no dejarlo huérfano en disco.
      await this.fileStorage.deleteFile(storageKey);
      throw error;
    }
  }

  // Busca el archivo de la última versión de un documento para mostrarlo en el navegador.
  async getDocumentFile(documentId: string) {
    const organization = await this.currentOrganization.getCurrentOrganization();

    // Se filtra por organización: no se puede abrir un documento de otra empresa aunque se conozca su id.
    const version = await this.prisma.documentVersion.findFirst({
      where: {
        organizationId: organization.organizationId,
        documentId: documentId,
        uploadStatus: 'STORED',
      },
      orderBy: { versionNumber: 'desc' },
    });

    if (version === null) {
      throw new NotFoundException('El documento no existe.');
    }

    const exists = await this.fileStorage.fileExists(version.storageKey);
    if (!exists) {
      throw new NotFoundException('El archivo del documento no se encuentra en el almacenamiento.');
    }

    return {
      stream: this.fileStorage.openFile(version.storageKey),
      fileName: version.originalName,
      mimeType: version.mimeType,
      sizeBytes: Number(version.sizeBytes),
    };
  }

  // Revisa que se haya enviado un archivo y que sea un PDF real.
  private validatePdfFile(file: Express.Multer.File | undefined): Express.Multer.File {
    if (file === undefined) {
      throw new BadRequestException('Debes adjuntar un archivo en el campo "file".');
    }

    if (file.size === 0) {
      throw new BadRequestException('El archivo está vacío.');
    }

    // No basta con la extensión ".pdf": todo PDF real empieza con los caracteres "%PDF-".
    const firstBytes = file.buffer.subarray(0, 5).toString('latin1');
    if (firstBytes !== '%PDF-') {
      throw new BadRequestException('Solo se aceptan archivos PDF.');
    }

    return file;
  }

  // Convierte el texto recibido en un tipo de documento válido. Si no viene, se usa "CV".
  private parseDocumentType(typeText: string | undefined): DocumentType {
    if (typeText === undefined || typeText === '') {
      return 'CV';
    }

    const documentType = ALLOWED_DOCUMENT_TYPES.find((allowedType) => allowedType === typeText);
    if (documentType === undefined) {
      throw new BadRequestException(`Tipo de documento inválido. Valores permitidos: ${ALLOWED_DOCUMENT_TYPES.join(', ')}.`);
    }

    return documentType;
  }

  // "CV Juan Pérez.pdf" -> "CV Juan Pérez"
  private createTitleFromFileName(fileName: string): string {
    const nameWithoutExtension = fileName.replace(/\.pdf$/i, '').trim();

    if (nameWithoutExtension === '') {
      return 'Documento sin nombre';
    }

    return nameWithoutExtension.slice(0, 200);
  }
}
