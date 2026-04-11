// Armazenamento de anexos como Base64 diretamente no Firestore.
// Limite: 500 KB por arquivo (documentos Firestore têm teto de 1 MB).

import { compressImageToDataURL } from './imageCompressor';

const MAX_SIZE_BYTES = 500 * 1024;
// Imagens são comprimidas antes da verificação; tamanho original pode ser maior.
const MAX_ORIGINAL_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB bruto é suficiente para comprimir

/**
 * Converte o arquivo para data URL (Base64) e retorna { url, name, type, size }.
 * Imagens são comprimidas automaticamente (máx 1200px, qualidade 0.75 JPEG).
 * onProgress é chamado de 0 a 100 durante a leitura.
 */
export const uploadTaskAttachment = (_taskId, file, onProgress) => {
  return new Promise(async (resolve, reject) => {
    const isImage = file.type.startsWith('image/');
    const sizeLimit = isImage ? MAX_ORIGINAL_IMAGE_SIZE : MAX_SIZE_BYTES;

    if (file.size > sizeLimit) {
      reject(new Error(`Arquivo muito grande. Máximo ${Math.round(sizeLimit / 1024 / 1024)} MB.`));
      return;
    }

    try {
      onProgress?.(10);
      const { dataURL, size } = await compressImageToDataURL(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.75,
      });
      onProgress?.(90);

      if (size > MAX_SIZE_BYTES) {
        reject(new Error(`Arquivo muito grande após compressão. Máximo ${Math.round(MAX_SIZE_BYTES / 1024)} KB.`));
        return;
      }

      onProgress?.(100);
      resolve({
        url: dataURL,
        name: file.name,
        type: isImage ? 'image/jpeg' : file.type,
        size,
      });
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * No-op: os dados ficam no Firestore e são removidos
 * ao excluir o item do array de anexos.
 */
export const deleteTaskAttachment = async (_path) => {};
