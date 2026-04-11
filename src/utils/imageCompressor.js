/**
 * Comprime uma imagem via Canvas e retorna uma data URL (Base64).
 * Arquivos que não são imagem são lidos sem alteração.
 *
 * @param {File|Blob} file
 * @param {object} options
 * @param {number} options.maxWidth  - largura máxima em px (padrão: 1200)
 * @param {number} options.maxHeight - altura máxima em px (padrão: 1200)
 * @param {number} options.quality   - qualidade JPEG 0–1 (padrão: 0.75)
 * @returns {Promise<{ dataURL: string, size: number }>}
 */
export const compressImageToDataURL = (file, {
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75,
} = {}) => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataURL = reader.result;
        const size = Math.round((dataURL.length * 3) / 4);
        resolve({ dataURL, size });
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
      reader.readAsDataURL(file);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const dataURL = canvas.toDataURL('image/jpeg', quality);
      // Estimate byte size: base64 overhead is ~4/3
      const size = Math.round((dataURL.length * 3) / 4);
      resolve({ dataURL, size });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Erro ao carregar imagem para compressão.'));
    };

    img.src = objectUrl;
  });
};
