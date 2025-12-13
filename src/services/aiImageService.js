/**
 * AI Image Generation Service
 * Использует Google Gemini API для генерации изображений
 */

const GEMINI_MODEL = 'gemini-2.5-flash-image';
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

const getApiKey = () => {
  const key = process.env.REACT_APP_GEMINI_API_KEY;
  if (!key) {
    console.error('REACT_APP_GEMINI_API_KEY не установлен');
  }
  return key;
};

export const ASPECT_RATIOS = [
  { id: '1:1', name: '1:1', desc: 'Квадрат' },
  { id: '3:2', name: '3:2', desc: 'Альбомный' },
  { id: '2:3', name: '2:3', desc: 'Портретный' },
  { id: '16:9', name: '16:9', desc: 'Широкий' },
  { id: '9:16', name: '9:16', desc: 'Вертикальный' }
];

export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve({ data: base64, mimeType: file.type });
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}

export async function imageToBase64(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const dataUrl = canvas.toDataURL('image/png');
  return { data: dataUrl.split(',')[1], mimeType: 'image/png' };
}

export async function checkApiAvailability() {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { available: false, error: 'API ключ не настроен' };
  }
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    if (response.ok) return { available: true };
    if (response.status === 429) return { available: false, error: 'Превышен лимит запросов' };
    return { available: false, error: 'Ключ недействителен' };
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
 * Генерация одного изображения с повторными попытками
 */
async function generateSingleImageWithRetry(prompt, apiKey, aspectRatio, referenceImage, index, retryCount = 0) {
  try {
    return await generateSingleImage(prompt, apiKey, aspectRatio, referenceImage, index);
  } catch (error) {
    const isRetryable = 
      error.message.includes('429') || 
      error.message.includes('Слишком много запросов') ||
      error.message.includes('Изображение не найдено') ||
      error.message.includes('Неверный формат');
    
    if (isRetryable && retryCount < MAX_RETRIES) {
      const delayMs = RETRY_DELAY_MS * (retryCount + 1);
      console.log(`Retry ${retryCount + 1}/${MAX_RETRIES} для изображения ${index} через ${delayMs}ms`);
      await delay(delayMs);
      return generateSingleImageWithRetry(prompt, apiKey, aspectRatio, referenceImage, index, retryCount + 1);
    }
    throw error;
  }
}

/**
 * Генерация изображений с гарантией количества
 */
export async function generateImages(prompt, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API ключ не настроен. Обратитесь к администратору.');
  }
  if (!prompt?.trim()) {
    throw new Error('Описание не может быть пустым');
  }

  const { count = 4, aspectRatio = '1:1', referenceImage = null } = options;
  const imageCount = Math.min(Math.max(count, 2), 4);
  
  const results = [];
  const errors = [];

  // Первая волна - параллельная генерация с небольшими задержками для избежания rate limit
  const initialPromises = Array.from({ length: imageCount }, async (_, i) => {
    // Добавляем небольшую задержку между запросами (200ms между каждым)
    if (i > 0) {
      await delay(i * 200);
    }
    
    try {
      const result = await generateSingleImageWithRetry(prompt, apiKey, aspectRatio, referenceImage, i);
      return { success: true, result };
    } catch (err) {
      return { success: false, index: i, error: err.message };
    }
  });

  const initialResults = await Promise.all(initialPromises);
  
  // Сортируем результаты
  for (const res of initialResults) {
    if (res.success) {
      results.push(res.result);
    } else {
      errors.push({ index: res.index, error: res.error });
    }
  }

  // Вторая волна - попытка дозаполнения для неудавшихся слотов
  if (errors.length > 0 && results.length < imageCount) {
    console.log(`Попытка дозаполнения: ${errors.length} неудавшихся из ${imageCount}`);
    
    const retryPromises = errors.map(async (err, retryIdx) => {
      await delay(retryIdx * 500); // Увеличенная задержка для retry
      
      try {
        // Пробуем сгенерировать с немного модифицированным промптом для разнообразия
        const modifiedPrompt = prompt + ` (variation ${err.index + 1})`;
        const result = await generateSingleImageWithRetry(
          modifiedPrompt, apiKey, aspectRatio, referenceImage, err.index
        );
        return { success: true, result, originalIndex: err.index };
      } catch (retryErr) {
        return { success: false, index: err.index, error: retryErr.message };
      }
    });

    const retryResults = await Promise.all(retryPromises);
    
    // Обновляем массивы
    const stillFailed = [];
    for (const res of retryResults) {
      if (res.success) {
        results.push(res.result);
      } else {
        stillFailed.push({ index: res.index, error: res.error });
      }
    }
    
    // Обновляем список ошибок
    errors.length = 0;
    errors.push(...stillFailed);
  }

  if (results.length === 0) {
    throw new Error(errors[0]?.error || 'Не удалось сгенерировать изображения');
  }

  // Если всё ещё не хватает изображений, пробуем заполнить дубликатами первого успешного
  if (results.length < imageCount && results.length > 0) {
    console.log(`Заполнение недостающих слотов: ${results.length}/${imageCount}`);
    
    const missingIndices = [];
    for (let i = 0; i < imageCount; i++) {
      if (!results.find(r => r.index === i)) {
        missingIndices.push(i);
      }
    }
    
    // Генерируем дополнительные изображения для пустых слотов
    for (const idx of missingIndices) {
      try {
        await delay(300);
        const result = await generateSingleImageWithRetry(
          prompt + ` (extra ${idx})`, apiKey, aspectRatio, referenceImage, idx
        );
        results.push(result);
      } catch (e) {
        console.warn(`Не удалось заполнить слот ${idx}:`, e.message);
      }
    }
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
 * Генерация одного изображения
 */
async function generateSingleImage(prompt, apiKey, aspectRatio, referenceImage, index) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const parts = [];
  if (referenceImage) {
    parts.push({
      inlineData: {
        mimeType: referenceImage.mimeType,
        data: referenceImage.data
      }
    });
  }
  parts.push({ text: prompt });

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 1.0,
      topP: 0.95,
      topK: 40
    }
  };

  if (aspectRatio && aspectRatio !== '1:1') {
    requestBody.generationConfig.imageConfig = { aspectRatio };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData.error?.message || `Ошибка API: ${response.status}`;
    if (response.status === 429) {
      throw new Error('Слишком много запросов. Подождите немного.');
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  
  if (!candidate?.content?.parts) {
    throw new Error('Неверный формат ответа');
  }

  for (const part of candidate.content.parts) {
    if (part.inlineData) {
      const { data: imageData, mimeType } = part.inlineData;
      return {
        index,
        dataUrl: `data:${mimeType};base64,${imageData}`,
        mimeType
      };
    }
  }

  throw new Error('Изображение не найдено в ответе');
}

export async function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    img.src = dataUrl;
  });
}

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

export function applyStyleToPrompt(prompt, styleId) {
  const style = STYLE_PRESETS.find(s => s.id === styleId);
  if (!style || style.id === 'none') return prompt;
  return prompt + style.suffix;
}

export const GEMINI_MODELS = { FLASH: GEMINI_MODEL };