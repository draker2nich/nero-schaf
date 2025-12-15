/**
 * Backend прокси для Gemini API
 * Запуск: node server/api.js
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3001;

// API ключ хранится ТОЛЬКО на сервере
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-image';

// Инициализация SDK
let ai = null;
if (GEMINI_API_KEY) {
  ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
}

// Настройки лимитов
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_DIMENSION = 2048;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

// Очистка старых записей
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10mb' }));

// Multer для загрузки файлов
const upload = multer({
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Недопустимый тип файла: ${file.mimetype}`));
    }
  }
});

/**
 * Оптимизация изображения
 */
async function optimizeImage(buffer, mimeType) {
  let image = sharp(buffer);
  const metadata = await image.metadata();
  
  if (metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
    image = image.resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }
  
  if (mimeType !== 'image/png') {
    image = image.jpeg({ quality: 85 });
    mimeType = 'image/jpeg';
  } else {
    image = image.png({ compressionLevel: 8 });
  }
  
  const optimizedBuffer = await image.toBuffer();
  return {
    data: optimizedBuffer.toString('base64'),
    mimeType
  };
}

/**
 * Проверка доступности API
 */
app.get('/api/ai/status', async (req, res) => {
  console.log('=== Проверка API ===');
  console.log('GEMINI_API_KEY существует:', !!GEMINI_API_KEY);
  console.log('ai инициализирован:', !!ai);
  
  if (!GEMINI_API_KEY || !ai) {
    console.log('API не настроен');
    return res.json({ available: false, error: 'API не настроен' });
  }
  
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`;
    console.log('Запрос к:', url.replace(GEMINI_API_KEY, 'API_KEY_HIDDEN'));
    
    const response = await fetch(url);
    console.log('Статус ответа:', response.status);
    
    const data = await response.json();
    console.log('Ответ:', JSON.stringify(data).substring(0, 200));
    
    if (response.ok) {
      return res.json({ available: true });
    }
    
    if (response.status === 429) {
      return res.json({ available: false, error: 'Превышен лимит запросов' });
    }
    
    return res.json({ available: false, error: data.error?.message || 'Ошибка API' });
  } catch (err) {
    console.error('Ошибка:', err);
    return res.json({ available: false, error: 'Ошибка подключения: ' + err.message });
  }
});

/**
 * Генерация изображений через SDK
 */
app.post('/api/ai/generate', upload.single('reference'), async (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  
  // Rate limiting
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({ 
      error: 'Слишком много запросов. Подождите минуту.' 
    });
  }
  
  if (!GEMINI_API_KEY || !ai) {
    return res.status(500).json({ error: 'API не настроен на сервере' });
  }
  
  try {
    const { prompt, aspectRatio, index } = req.body;
    
    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Описание не может быть пустым' });
    }
    
    // Подготовка контента для SDK
    const contents = [];
    
    // Обработка референсного изображения из файла
    if (req.file) {
      const optimized = await optimizeImage(req.file.buffer, req.file.mimetype);
      contents.push({
        inlineData: {
          mimeType: optimized.mimeType,
          data: optimized.data
        }
      });
    }
    
    // Обработка base64 референса из body
    if (req.body.referenceData && req.body.referenceMimeType) {
      const buffer = Buffer.from(req.body.referenceData, 'base64');
      const optimized = await optimizeImage(buffer, req.body.referenceMimeType);
      contents.push({
        inlineData: {
          mimeType: optimized.mimeType,
          data: optimized.data
        }
      });
    }
    
    // Добавляем текстовый промпт
    contents.push({ text: prompt });
    
    // Конфигурация генерации
    const config = {
      responseModalities: ['TEXT', 'IMAGE']
    };
    
    // Добавляем aspectRatio если указан
    if (aspectRatio && aspectRatio !== '1:1') {
      config.imageConfig = { aspectRatio };
    }
    
    // Вызов SDK
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: contents,
      config: config
    });
    
    // Обработка ответа
    const candidate = response.candidates?.[0];
    
    if (!candidate?.content?.parts) {
      return res.status(500).json({ error: 'Неверный формат ответа от API' });
    }
    
    // Ищем изображение в ответе
    for (const part of candidate.content.parts) {
      if (part.inlineData) {
        return res.json({
          index: parseInt(index) || 0,
          data: part.inlineData.data,
          mimeType: part.inlineData.mimeType
        });
      }
    }
    
    // Если есть только текст, возвращаем ошибку
    const textPart = candidate.content.parts.find(p => p.text);
    if (textPart) {
      console.log('API вернул текст вместо изображения:', textPart.text);
    }
    
    return res.status(500).json({ error: 'Изображение не найдено в ответе' });
    
  } catch (err) {
    console.error('Generation error:', err);
    
    // Обработка специфичных ошибок
    if (err.message?.includes('429') || err.status === 429) {
      return res.status(429).json({ 
        error: 'Лимит API исчерпан. Попробуйте позже.' 
      });
    }
    
    if (err.message?.includes('SAFETY')) {
      return res.status(400).json({ 
        error: 'Запрос заблокирован фильтром безопасности. Попробуйте другое описание.' 
      });
    }
    
    return res.status(500).json({ 
      error: err.message || 'Внутренняя ошибка сервера' 
    });
  }
});

/**
 * Загрузка и оптимизация изображения
 */
app.post('/api/upload/image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  
  try {
    const optimized = await optimizeImage(req.file.buffer, req.file.mimetype);
    
    res.json({
      data: optimized.data,
      mimeType: optimized.mimeType,
      originalSize: req.file.size,
      optimizedSize: Buffer.byteLength(optimized.data, 'base64')
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Ошибка обработки изображения' });
  }
});

// Обработка ошибок multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: `Файл слишком большой. Максимум ${MAX_FILE_SIZE / 1024 / 1024}MB` 
      });
    }
  }
  
  if (err.message) {
    return res.status(400).json({ error: err.message });
  }
  
  next(err);
});

app.listen(PORT, () => {
  console.log(`API сервер запущен на порту ${PORT}`);
  console.log(`GEMINI_API_KEY: ${GEMINI_API_KEY ? 'настроен ✓' : 'НЕ НАСТРОЕН!'}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});