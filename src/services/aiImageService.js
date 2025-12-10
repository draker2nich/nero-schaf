/**
 * AI Image Generation Service
 * Использует Google Gemini API для генерации изображений
 */

const GEMINI_MODELS = {
  FLASH: 'gemini-2.5-flash-image',
  PRO: 'gemini-2.5-pro-image'
};

const DEFAULT_CONFIG = {
  model: GEMINI_MODELS.FLASH,
  aspectRatio: '1:1'
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
 * Генерация изображений через Gemini API
 */
export async function generateImages(prompt, options = {}) {
  const { 
    apiKey, 
    count = 4, 
    aspectRatio = '1:1',
    model = GEMINI_MODELS.FLASH 
  } = options;

  if (!apiKey) {
    throw new Error('API ключ не указан');
  }

  if (!prompt?.trim()) {
    throw new Error('Промпт не может быть пустым');
  }

  const imageCount = Math.min(Math.max(count, 2), 6);
  const results = [];
  const errors = [];

  // Генерируем изображения параллельно
  const promises = Array.from({ length: imageCount }, (_, i) => 
    generateSingleImage(prompt, apiKey, model, aspectRatio, i)
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
    prompt,
    model
  };
}

/**
 * Генерация одного изображения
 */
async function generateSingleImage(prompt, apiKey, model, aspectRatio, index) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      // Добавляем небольшую вариативность для разных результатов
      temperature: 1.0,
      topP: 0.95,
      topK: 40
    }
  };

  // Добавляем конфиг изображения если поддерживается
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
    throw new Error(errorData.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Извлекаем изображение из ответа
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts) {
    throw new Error('Неверный формат ответа API');
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

/**
 * Проверка валидности API ключа
 */
export async function validateApiKey(apiKey) {
  if (!apiKey || apiKey.length < 30) {
    return { valid: false, error: 'Неверный формат ключа' };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(url);
    
    if (response.ok) {
      return { valid: true };
    }
    
    const data = await response.json().catch(() => ({}));
    return { 
      valid: false, 
      error: data.error?.message || 'Ключ недействителен' 
    };
  } catch (err) {
    return { valid: false, error: 'Ошибка проверки ключа' };
  }
}

export { GEMINI_MODELS };