import { CANVAS_SIZE, TOOLS } from './constants';

// Кэш для UV маски
let uvMaskData = null;
let uvMaskWidth = 0;
let uvMaskHeight = 0;

// Кэш для кистей
const brushCache = new Map();
const MAX_CACHE_SIZE = 50;

/**
 * Инициализация кэша UV маски
 */
export function initUVMaskCache(uvLayoutImage) {
  if (!uvLayoutImage) {
    uvMaskData = null;
    return;
  }
  
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  
  uvMaskData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
  uvMaskWidth = CANVAS_SIZE;
  uvMaskHeight = CANVAS_SIZE;
}

/**
 * Проверка пикселя в UV маске
 */
export function isPixelInUVMask(x, y) {
  if (!uvMaskData) return true;
  
  const ix = Math.round(x);
  const iy = Math.round(y);
  
  if (ix < 0 || ix >= uvMaskWidth || iy < 0 || iy >= uvMaskHeight) {
    return false;
  }
  
  const idx = (iy * uvMaskWidth + ix) * 4 + 3;
  return uvMaskData[idx] > 0;
}

/**
 * Парсинг цвета в RGB
 */
export function parseColor(color) {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16)
      };
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }
  
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
  }
  
  return { r: 0, g: 0, b: 0 };
}

/**
 * Вычисление профиля жёсткости кисти
 */
function calculateBrushAlpha(distance, hardness) {
  const h = hardness / 100;
  
  if (h >= 0.99) return distance <= 1 ? 1 : 0;
  
  if (h <= 0.01) {
    const sigma = 0.4;
    return Math.max(0, Math.exp(-Math.pow(distance, 2) / (2 * sigma * sigma)));
  }
  
  const solidRadius = h * 0.8;
  if (distance <= solidRadius) return 1;
  if (distance >= 1) return 0;
  
  const t = (distance - solidRadius) / (1 - solidRadius);
  const smoothT = t * t * t * (t * (t * 6 - 15) + 10);
  return 1 - smoothT;
}

/**
 * Рисование точки с градиентом (поддержка opacity)
 */
function drawPointWithGradient(x, y, tool, brushColor, brushSize, ctx, hardness, opacity = 100) {
  ctx.save();
  
  // Применяем общую прозрачность
  ctx.globalAlpha = opacity / 100;
  
  const h = hardness / 100;
  
  if (tool === TOOLS.DRAW) {
    const rgb = parseColor(brushColor);
    const { r, g, b } = rgb;
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, brushSize);
    
    if (h >= 0.99) {
      gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
      gradient.addColorStop(0.99, `rgba(${r},${g},${b},1)`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
    } else if (h <= 0.01) {
      gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
      gradient.addColorStop(0.15, `rgba(${r},${g},${b},0.9)`);
      gradient.addColorStop(0.3, `rgba(${r},${g},${b},0.65)`);
      gradient.addColorStop(0.45, `rgba(${r},${g},${b},0.4)`);
      gradient.addColorStop(0.6, `rgba(${r},${g},${b},0.2)`);
      gradient.addColorStop(0.75, `rgba(${r},${g},${b},0.08)`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
    } else {
      const solidStop = h * 0.8;
      const fadeLen = 1 - solidStop;
      
      gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
      gradient.addColorStop(solidStop, `rgba(${r},${g},${b},1)`);
      gradient.addColorStop(solidStop + fadeLen * 0.25, `rgba(${r},${g},${b},0.7)`);
      gradient.addColorStop(solidStop + fadeLen * 0.5, `rgba(${r},${g},${b},0.35)`);
      gradient.addColorStop(solidStop + fadeLen * 0.75, `rgba(${r},${g},${b},0.1)`);
      gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
    }
    
    ctx.fillStyle = gradient;
  } else if (tool === TOOLS.ERASE) {
    ctx.globalCompositeOperation = 'destination-out';
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, brushSize);
    
    if (h >= 0.99) {
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.99, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
    } else if (h <= 0.01) {
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.3, 'rgba(255,255,255,0.65)');
      gradient.addColorStop(0.6, 'rgba(255,255,255,0.2)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      const solidStop = h * 0.8;
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(solidStop, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
    }
    
    ctx.fillStyle = gradient;
  }
  
  ctx.beginPath();
  ctx.arc(x, y, brushSize, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Рисование линии с поддержкой hardness и opacity
 */
export function drawLine(x0, y0, x1, y1, tool, brushColor, brushSize, drawingCtx, hardness = 80, opacity = 100) {
  const dist = getDistance(x0, y0, x1, y1);
  const density = hardness < 50 ? 0.15 : 0.25;
  const steps = Math.max(1, Math.ceil(dist / (brushSize * density)));
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    drawPointWithGradient(x, y, tool, brushColor, brushSize, drawingCtx, hardness, opacity);
  }
}

/**
 * Рисование точки (публичный API)
 */
export function drawPoint(x, y, tool, brushColor, brushSize, drawingCtx, hardness = 80, opacity = 100) {
  if (tool === TOOLS.DRAW && !isPixelInUVMask(x, y)) return;
  drawPointWithGradient(x, y, tool, brushColor, brushSize, drawingCtx, hardness, opacity);
}

/**
 * Получение координат на canvas (legacy, для совместимости)
 */
export function getCanvasCoords(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  const clientX = touch ? touch.clientX : e.clientX;
  const clientY = touch ? touch.clientY : e.clientY;
  
  return {
    x: (clientX - rect.left) * (CANVAS_SIZE / rect.width),
    y: (clientY - rect.top) * (CANVAS_SIZE / rect.height)
  };
}

/**
 * Расстояние между точками
 */
export function getDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Применение UV маски
 */
export function applyUVMask(canvas, uvLayoutImage) {
  if (!uvLayoutImage) return;
  
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.restore();
}

/**
 * Генерация превью кисти для UI
 */
export function generateBrushPreview(size, hardness, color = '#000000') {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  const center = size / 2;
  const radius = size / 2 - 2;
  
  const rgb = parseColor(color);
  const { r, g, b } = rgb;
  const h = hardness / 100;
  
  // Шахматный фон
  const checkerSize = 4;
  for (let y = 0; y < size; y += checkerSize) {
    for (let x = 0; x < size; x += checkerSize) {
      const isLight = ((x / checkerSize) + (y / checkerSize)) % 2 === 0;
      ctx.fillStyle = isLight ? '#f0f0f0' : '#d0d0d0';
      ctx.fillRect(x, y, checkerSize, checkerSize);
    }
  }
  
  // Градиент кисти
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
  
  if (h >= 0.99) {
    gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
    gradient.addColorStop(0.99, `rgba(${r},${g},${b},1)`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  } else if (h <= 0.01) {
    gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
    gradient.addColorStop(0.3, `rgba(${r},${g},${b},0.65)`);
    gradient.addColorStop(0.6, `rgba(${r},${g},${b},0.2)`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  } else {
    const solidStop = h * 0.8;
    gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
    gradient.addColorStop(solidStop, `rgba(${r},${g},${b},1)`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  }
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fill();
  
  return canvas.toDataURL();
}

/**
 * Очистка кэша кистей
 */
export function clearBrushCache() {
  brushCache.clear();
}