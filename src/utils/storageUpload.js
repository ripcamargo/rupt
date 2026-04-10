// Armazenamento de anexos como Base64 diretamente no Firestore.
// Limite: 500 KB por arquivo (documentos Firestore têm teto de 1 MB).

const MAX_SIZE_BYTES = 500 * 1024;

/**
 * Converte o arquivo para data URL (Base64) e retorna { url, name, type, size }.
 * onProgress é chamado de 0 a 100 durante a leitura.
 */
export const uploadTaskAttachment = (_taskId, file, onProgress) => {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_SIZE_BYTES) {
      reject(new Error(`Arquivo muito grande. Máximo ${Math.round(MAX_SIZE_BYTES / 1024)} KB.`));
      return;
    }

    const reader = new FileReader();

    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    reader.onload = () => {
      onProgress?.(100);
      resolve({
        url: reader.result,
        name: file.name,
        type: file.type,
        size: file.size,
      });
    };

    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));

    reader.readAsDataURL(file);
  });
};

/**
 * No-op: os dados ficam no Firestore e são removidos
 * ao excluir o item do array de anexos.
 */
export const deleteTaskAttachment = async (_path) => {};
