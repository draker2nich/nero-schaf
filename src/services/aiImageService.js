/**
 * AI Image Generation Service
 * Использует Google Gemini API для генерации изображений
 * 
 * API ключ загружается из переменной окружения REACT_APP_GEMINI_API_KEY
 * Для production: добавьте ключ в .env файл
 */

const GEMINI_MODEL = 'gemini-2.5-flash-image';

// Получение API ключа из env
const getApiKey = () => {
  const key = process.env.REACT_APP_GEMINI_API_KEY;
  if (!key) {
    console.error('REACT_APP_GEMINI_API_KEY не установлен в переменных окружения');
  }
  return key;
};

// Доступные соотношения сторон
export const ASPECT_RATIOS = [
  { id: '1:1', name: '1:1', desc: 'Квадрат' },
  { id: '3:2', name: '3:2', desc: 'Альбомный' },
  { id: '2:3', name: '2:3', desc: 'Портретный' },
  { id: '16:9', name: '16:9', desc: 'Широкий' },
  { id: '9:16', name: '9:16', desc: 'Вертикальный' }
];

/**
 * Конвертация файла в base64
 */
export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(',')[1];
      resolve({
        data: base64,
        mimeType: file.type
      });
    };
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}

/**
 * Конвертация Image объекта в base64
 */
export async function imageToBase64(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  
  const dataUrl = canvas.toDataURL('image/png');
  return {
    data: dataUrl.split(',')[1],
    mimeType: 'image/png'
  };
}

/**
 * Проверка доступности API
 */
export async function checkApiAvailability() {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return { available: false, error: 'API ключ не настроен' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    
    if (response.ok) {
      return { available: true };
    }
    
    if (response.status === 429) {
      return { available: false, error: 'Превышен лимит запросов' };
    }
    
    return { available: false, error: 'Ключ недействителен' };
  } catch (err) {
    return { available: false, error: 'Ошибка подключения к серверу' };
  }
}

/**
 * Генерация изображений через Gemini API
 */
export async function generateImages(prompt, options = {}) {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    throw new Error('API ключ не настроен. Обратитесь к администратору.');
  }

  if (!prompt?.trim()) {
    throw new Error('Описание не может быть пустым');
  }

  const { 
    count = 4, 
    aspectRatio = '1:1',
    referenceImage = null
  } = options;

  const imageCount = Math.min(Math.max(count, 2), 4);
  const results = [];
  const errors = [];

  // Генерируем изображения параллельно
  const promises = Array.from({ length: imageCount }, (_, i) => 
    generateSingleImage(prompt, apiKey, aspectRatio, referenceImage, i)
      .then(result => results.push(result))
      .catch(err => errors.push({ index: i, error: err.message }))
  );

  await Promise.all(promises);

  if (results.length === 0) {
    throw new Error(errors[0]?.error || 'Не удалось сгенерировать изображения');
  }

  return {
    images: results.sort((a, b) => a.index - b.index),
    errors: errors.length > 0 ? errors : null,
    prompt
  };
}

/**
 * Генерация одного изображения
 */
async function generateSingleImage(prompt, apiKey, aspectRatio, referenceImage, index) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // Формируем содержимое запроса
  const parts = [];
  
  // Если есть референс изображение - добавляем его первым
  if (referenceImage) {
    parts.push({
      inlineData: {
        mimeType: referenceImage.mimeType,
        data: referenceImage.data
      }
    });
  }
  
  // Добавляем текстовый промпт
  parts.push({ text: prompt });

  const requestBody = {
    contents: [{
      parts
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 1.0,
      topP: 0.95,
      topK: 40
    }
  };

  if (aspectRatio && aspectRatio !== '1:1') {
    requestBody.generationConfig.imageConfig = {
      aspectRatio: aspectRatio
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
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

/**
 * Загрузка изображения по data URL и конвертация в Image объект
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
 * Предустановленные стили для генерации
 */
export const STYLE_PRESETS = [
  {
    id: 'none',
    name: 'Без стиля',
    suffix: '',
    icon: '✨'
  },
  {
    id: 'realistic',
    name: 'Реалистичный',
    suffix: ', photorealistic, high detail, 8k resolution, professional photography',
    icon: '📷'
  },
  {
    id: 'anime',
    name: 'Аниме',
    suffix: ', anime style, vibrant colors, detailed illustration, manga art',
    icon: '🎨'
  },
  {
    id: 'watercolor',
    name: 'Акварель',
    suffix: ', watercolor painting, soft colors, artistic, delicate brushstrokes',
    icon: '🖌️'
  },
  {
    id: 'minimalist',
    name: 'Минимализм',
    suffix: ', minimalist design, clean lines, simple shapes, modern aesthetic',
    icon: '⬜'
  },
  {
    id: 'pattern',
    name: 'Паттерн',
    suffix: ', seamless pattern, repeating design, textile print, tileable',
    icon: '🔲'
  },
  {
    id: 'vintage',
    name: 'Винтаж',
    suffix: ', vintage style, retro aesthetic, nostalgic, aged look',
    icon: '📺'
  },
  {
    id: 'abstract',
    name: 'Абстракция',
    suffix: ', abstract art, geometric shapes, modern art, artistic expression',
    icon: '🔷'
  }
];

/**
 * Применение стиля к промпту
 */
export function applyStyleToPrompt(prompt, styleId) {
  const style = STYLE_PRESETS.find(s => s.id === styleId);
  if (!style || style.id === 'none') return prompt;
  return prompt + style.suffix;
}

export const GEMINI_MODELS = {
  FLASH: GEMINI_MODEL
};