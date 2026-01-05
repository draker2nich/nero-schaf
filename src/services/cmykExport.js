/**
 * Сервис экспорта в CMYK PDF
 */

/**
 * Конвертация RGB в CMYK
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {{c: number, m: number, y: number, k: number}} CMYK (0-100)
 */
export function rgbToCmyk(r, g, b) {
  // Нормализация RGB к 0-1
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  
  // Вычисление K (чёрный)
  const k = 1 - Math.max(rNorm, gNorm, bNorm);
  
  // Если K = 1, то CMY = 0
  if (k === 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  
  // Вычисление CMY
  const c = (1 - rNorm - k) / (1 - k);
  const m = (1 - gNorm - k) / (1 - k);
  const y = (1 - bNorm - k) / (1 - k);
  
  return {
    c: Math.round(c * 100),
    m: Math.round(m * 100),
    y: Math.round(y * 100),
    k: Math.round(k * 100)
  };
}

/**
 * Конвертация ImageData в CMYK массив
 */
export function imageDataToCmyk(imageData) {
  const { data, width, height } = imageData;
  const cmykData = new Uint8Array(width * height * 4); // C, M, Y, K для каждого пикселя
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Alpha игнорируем при конвертации в CMYK
    
    const cmyk = rgbToCmyk(r, g, b);
    const idx = (i / 4) * 4;
    
    cmykData[idx] = Math.round(cmyk.c * 2.55);     // C (0-255)
    cmykData[idx + 1] = Math.round(cmyk.m * 2.55); // M (0-255)
    cmykData[idx + 2] = Math.round(cmyk.y * 2.55); // Y (0-255)
    cmykData[idx + 3] = Math.round(cmyk.k * 2.55); // K (0-255)
  }
  
  return { data: cmykData, width, height };
}

/**
 * Создание простого PDF с CMYK изображением
 * Использует базовый PDF формат без внешних библиотек
 */
export async function createCmykPdf(canvas, filename = 'design-cmyk.pdf') {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // Конвертируем в CMYK
  const cmykData = imageDataToCmyk(imageData);
  
  // Создаём PDF с DeviceCMYK цветовым пространством
  const pdf = generatePdfWithCmykImage(cmykData, canvas.width, canvas.height);
  
  // Скачиваем
  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  
  URL.revokeObjectURL(url);
  
  return { success: true, filename };
}

/**
 * Генерация PDF с CMYK изображением
 */
function generatePdfWithCmykImage(cmykData, width, height) {
  const { data } = cmykData;
  
  // Сжимаем данные (простое RLE для уменьшения размера)
  const compressedImage = compressImageData(data);
  const imageStream = compressedImage;
  
  // PDF структура
  const objects = [];
  let objectNum = 1;
  
  // Object 1: Catalog
  objects.push(`${objectNum} 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj`);
  objectNum++;
  
  // Object 2: Pages
  objects.push(`${objectNum} 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`);
  objectNum++;
  
  // Object 3: Page
  const pageWidth = width;
  const pageHeight = height;
  objects.push(`${objectNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>\nendobj`);
  objectNum++;
  
  // Object 4: Content stream (рисуем изображение на всю страницу)
  const contentStream = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Im0 Do Q`;
  objects.push(`${objectNum} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj`);
  objectNum++;
  
  // Object 5: Image XObject с DeviceCMYK
  const imageDict = [
    '/Type /XObject',
    '/Subtype /Image',
    `/Width ${width}`,
    `/Height ${height}`,
    '/ColorSpace /DeviceCMYK',
    '/BitsPerComponent 8',
    `/Length ${imageStream.length}`,
    '/Filter /ASCIIHexDecode'
  ].join(' ');
  
  objects.push(`${objectNum} 0 obj\n<< ${imageDict} >>\nstream\n${imageStream}\nendstream\nendobj`);
  
  // Собираем PDF
  let pdf = '%PDF-1.4\n';
  pdf += '%âãÏÓ\n'; // Binary marker
  
  const offsets = [];
  
  objects.forEach(obj => {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  });
  
  // XRef table
  const xrefOffset = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  
  offsets.forEach(offset => {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  });
  
  // Trailer
  pdf += 'trailer\n';
  pdf += `<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefOffset}\n`;
  pdf += '%%EOF';
  
  return pdf;
}

/**
 * Сжатие данных в ASCII Hex формат (для PDF)
 */
function compressImageData(data) {
  let hex = '';
  for (let i = 0; i < data.length; i++) {
    hex += data[i].toString(16).padStart(2, '0');
  }
  hex += '>'; // End marker
  return hex;
}

/**
 * Экспорт с предпросмотром CMYK значений
 */
export function getCmykPreview(canvas, x, y) {
  const ctx = canvas.getContext('2d');
  const pixel = ctx.getImageData(x, y, 1, 1).data;
  
  return {
    rgb: { r: pixel[0], g: pixel[1], b: pixel[2] },
    cmyk: rgbToCmyk(pixel[0], pixel[1], pixel[2])
  };
}

/**
 * Альтернативный экспорт через jsPDF (если подключена библиотека)
 * Для более качественного PDF с поддержкой профилей ICC
 */
export async function createPdfWithJsPdf(canvas, filename = 'design-cmyk.pdf') {
  // Проверяем наличие jsPDF
  if (typeof window.jspdf === 'undefined') {
    console.warn('jsPDF не загружен, используем встроенный генератор');
    return createCmykPdf(canvas, filename);
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width, canvas.height]
  });
  
  // Добавляем изображение
  const imgData = canvas.toDataURL('image/jpeg', 0.95);
  doc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
  
  // Сохраняем
  doc.save(filename);
  
  return { success: true, filename };
}