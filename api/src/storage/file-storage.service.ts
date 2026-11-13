import { Injectable } from '@nestjs/common';
import { createReadStream, ReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';

/**
 * Guarda y elimina archivos en una carpeta del disco (config.storageDir).
 *
 * Cada archivo se identifica con una "storage key", por ejemplo:
 *   "<organizationId>/<documentId>/<versionId>.pdf"
 * La base de datos guarda esa key, no la ruta completa del disco.
 *
 * Más adelante se puede reemplazar por Supabase Storage cambiando solo este servicio.
 */
@Injectable()
export class FileStorageService {
  async saveFile(storageKey: string, content: Buffer): Promise<void> {
    const filePath = this.getFilePath(storageKey);

    // Crea las carpetas intermedias si no existen.
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // flag 'wx': falla si el archivo ya existe. Un archivo guardado nunca se sobrescribe.
    await fs.writeFile(filePath, content, { flag: 'wx' });
  }

  // Indica si el archivo existe en disco.
  async fileExists(storageKey: string): Promise<boolean> {
    try {
      await fs.access(this.getFilePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  // Abre el archivo para enviarlo de a poco (sin cargarlo completo en memoria).
  openFile(storageKey: string): ReadStream {
    return createReadStream(this.getFilePath(storageKey));
  }

  // Lee el archivo completo en memoria (para procesarlo, por ejemplo extraer el texto de un PDF).
  async readFile(storageKey: string): Promise<Buffer> {
    return fs.readFile(this.getFilePath(storageKey));
  }

  async deleteFile(storageKey: string): Promise<void> {
    const filePath = this.getFilePath(storageKey);
    await fs.rm(filePath, { force: true });
  }

  // Convierte una storage key en una ruta dentro de la carpeta de almacenamiento.
  private getFilePath(storageKey: string): string {
    const filePath = path.resolve(config.storageDir, storageKey);

    // Seguridad: la ruta final debe quedar dentro de la carpeta de almacenamiento (evita "../").
    if (!filePath.startsWith(config.storageDir + path.sep)) {
      throw new Error(`Storage key inválida: ${storageKey}`);
    }

    return filePath;
  }
}
