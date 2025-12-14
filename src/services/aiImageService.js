// URL бекенда - настраивается через env или по умолчанию
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// Лимиты для клиентской валидации
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_DIMENSION = 2048;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const ASPECT_RATIOS = [
  { id: '1:1', name: '1:1', desc: 'Квадрат' },
  { id: '3:2', name: '3:2', desc: 'Альбомный' },
  { id: '2:3', name: '2:3', desc: 'Портретный' },
  { id: '16:9', name: '16:9', desc: 'Широкий' },
  { id: '9:16', name: '9:16', desc: 'Вертикальный' }
];

export const STYLE_PRESETS = [
  { id: 'none', name: 'Без стиля', suffix: '', icon: '✨' },
  { id: 'realistic', name: 'Реалистичный', suffix: ', photorealistic, high detail, 8k resolution, professional photography', icon: '📷' },
  { id: 'anime', name: 'Аниме', suffix: ', anime style, vibrant colors, detailed illustration, manga art', icon: '🎨' },
  { id: 'watercolor', name: 'Акварель', suffix: ', watercolor painting, soft colors, artistic, delicate brushstrokes', icon: '🖌️' },
  { id: 'minimalist', name: 'Минимализм', suffix: ', minimalist design, clean lines, simple shapes, modern aesthetic', icon: '⬜' },
  { id: 'pattern', name: 'Паттерн', suffix: ', seamless pattern, repeating design, textile print, tileable', icon: '🔲' },
  { id: 'vintage', name: 'Винтаж', suffix: ', vintage style, retro aesthetic, nostalgic, aged look', icon: '📺' },
  { id: 'abstract', name: 'Абстракция', suffix: ', abstract art, geometric shapes, modern art, artistic expression', icon: '🔷' }
];

/**
 * Валидация файла на клиенте
 */
function validateFile(file) {
  if (!file) {
    throw new Error('Файл не выбран');
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Недопустимый формат. Разрешены: JPEG, PNG, WebP, GIF`);
  }
  
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Файл слишком большой. Максимум ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
}

/**
 * Ресайз изображения на клиенте перед отправкой
 */
async function resizeImageClient(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      
      let { width, height } = img;
      
      // Если изображение уже маленькое, просто конвертируем в base64
      if (width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob(
          (blob) => resolve(blob),
          file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          0.9
        );
        return;
      }
      
      // Ресайз
      const scale = Math.min(
        MAX_IMAGE_DIMENSION / width,
        MAX_IMAGE_DIMENSION / height
      );
      
      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);
      
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      canvas.toBlob(
        (blob) => resolve(blob),
        file.type === 'image/png' ? 'image/png' : 'image/jpeg',
        0.85
      );
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось загрузить изображение'));
    };
    
    img.src = url;
  });
}

/**
 * Конвертация файла в base64 с оптимизацией
 */
export async function fileToBase64(file) {
  validateFile(file);
  
  // Ресайзим на клиенте если нужно
  const optimizedBlob = await resizeImageClient(file);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve({ 
        data: base64, 
        mimeType: optimizedBlob.type,
        previewUrl: URL.createObjectURL(optimizedBlob)
      });
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(optimizedBlob);
  });
}

/**
 * Конвертация Image элемента в base64
 */
export async function imageToBase64(img) {
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;
  
  // Ресайз если нужно
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    const scale = Math.min(
      MAX_IMAGE_DIMENSION / width,
      MAX_IMAGE_DIMENSION / height
    );
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { 
    data: dataUrl.split(',')[1], 
    mimeType: 'image/jpeg' 
  };
}

/**
 * Проверка доступности API
 */
export async function checkApiAvailability() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      return { available: false, error: 'Сервер недоступен' };
    }
    
    return await response.json();
  } catch (err) {
    return { available: false, error: 'Ошибка подключения к серверу' };
  }
}

/**
 * Задержка для retry
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Генерация одного изображения через backend
 */
async function generateSingleImage(prompt, aspectRatio, referenceImage, index) {
  const body = {
    prompt,
    aspectRatio,
    index: index.toString()
  };
  
  // Добавляем референс если есть
  if (referenceImage) {
    body.referenceData = referenceImage.data;
    body.referenceMimeType = referenceImage.mimeType;
  }
  
  const response = await fetch(`${API_BASE_URL}/api/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Ошибка сервера: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    index: data.index,
    dataUrl: `data:${data.mimeType};base64,${data.data}`,
    mimeType: data.mimeType
  };
}

/**
 * Генерация с retry
 */
async function generateWithRetry(prompt, aspectRatio, referenceImage, index, retryCount = 0) {
  try {
    return await generateSingleImage(prompt, aspectRatio, referenceImage, index);
  } catch (error) {
    const isRetryable = 
      error.message.includes('429') || 
      error.message.includes('Лимит') ||
      error.message.includes('Слишком много');
    
    if (isRetryable && retryCount < MAX_RETRIES) {
      const delayMs = RETRY_DELAY_MS * (retryCount + 1);
      console.log(`Retry ${retryCount + 1}/${MAX_RETRIES} для изображения ${index}`);
      await delay(delayMs);
      return generateWithRetry(prompt, aspectRatio, referenceImage, index, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Генерация нескольких изображений
 */
export async function generateImages(prompt, options = {}) {
  if (!prompt?.trim()) {
    throw new Error('Описание не может быть пустым');
  }

  const { count = 4, aspectRatio = '1:1', referenceImage = null } = options;
  const imageCount = Math.min(Math.max(count, 2), 4);
  
  const results = [];
  const errors = [];

  // Генерируем последовательно с небольшими задержками
  for (let i = 0; i < imageCount; i++) {
    if (i > 0) {
      await delay(300); // Задержка между запросами
    }
    
    try {
      const result = await generateWithRetry(prompt, aspectRatio, referenceImage, i);
      results.push(result);
    } catch (err) {
      console.error(`Ошибка генерации ${i}:`, err.message);
      errors.push({ index: i, error: err.message });
    }
  }

  if (results.length === 0) {
    throw new Error(errors[0]?.error || 'Не удалось сгенерировать изображения');
  }

  return {
    images: results.sort((a, b) => a.index - b.index),
    errors: errors.length > 0 ? errors : null,
    prompt,
    requestedCount: imageCount,
    actualCount: results.length
  };
}

/**
 * Загрузка изображения из dataUrl
 */
export async function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    img.src = dataUrl;
  });
}

/**
 * Применение стиля к промпту
 */
export function applyStyleToPrompt(prompt, styleId) {
  const style = STYLE_PRESETS.find(s => s.id === styleId);
  if (!style || style.id === 'none') return prompt;
  return prompt + style.suffix;
}

export const GEMINI_MODELS = { FLASH: 'gemini-2.0-flash-exp' };