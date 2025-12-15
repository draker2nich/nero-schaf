import { CANVAS_SIZE, TOOLS } from './constants';

// Кэш для UV маски
let uvMaskData = null;
let uvMaskWidth = 0;
let uvMaskHeight = 0;

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
 * Создание градиента для мягкого края кисти
 * @param {CanvasRenderingContext2D} ctx - контекст
 * @param {number} x - центр X
 * @param {number} y - центр Y
 * @param {number} radius - радиус кисти
 * @param {string} color - цвет (hex или rgb)
 * @param {number} hardness - жёсткость края (0-100)
 */
function createBrushGradient(ctx, x, y, radius, color, hardness) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  
  // Парсим цвет в RGB
  const rgb = parseColor(color);
  const { r, g, b } = rgb;
  
  // Жёсткость определяет, где начинается затухание
  // hardness = 100: затухание начинается в самом конце (жёсткий край)
  // hardness = 0: затухание начинается сразу от центра (мягкий край)
  const hardnessNorm = hardness / 100;
  const solidStop = hardnessNorm * 0.9; // Где заканчивается полная непрозрачность
  
  gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gradient.addColorStop(solidStop, `rgba(${r},${g},${b},1)`);
  gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
  
  return gradient;
}

/**
 * Создание градиента для ластика с мягким краем
 */
function createEraserGradient(ctx, x, y, radius, hardness) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  
  const hardnessNorm = hardness / 100;
  const solidStop = hardnessNorm * 0.9;
  
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(solidStop, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  
  return gradient;
}

/**
 * Парсинг цвета в RGB
 */
function parseColor(color) {
  // Hex формат
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
  
  // RGB/RGBA формат
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
  }
  
  return { r: 0, g: 0, b: 0 };
}

/**
 * Рисование линии с настройкой жёсткости края
 */
export function drawLine(x0, y0, x1, y1, tool, brushColor, brushSize, drawingCtx, hardness = 80) {
  const dist = getDistance(x0, y0, x1, y1);
  const steps = Math.max(1, Math.ceil(dist / (brushSize * 0.3)));
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    drawPointWithHardness(x, y, tool, brushColor, brushSize, drawingCtx, hardness);
  }
}

/**
 * Рисование точки с настройкой жёсткости
 */
function drawPointWithHardness(x, y, tool, brushColor, brushSize, drawingCtx, hardness) {
  drawingCtx.save();
  
  if (tool === TOOLS.DRAW) {
    if (hardness >= 95) {
      // Жёсткий край - простой круг
      drawingCtx.fillStyle = brushColor;
      drawingCtx.beginPath();
      drawingCtx.arc(x, y, brushSize, 0, Math.PI * 2);
      drawingCtx.fill();
    } else {
      // Мягкий край - градиент
      const gradient = createBrushGradient(drawingCtx, x, y, brushSize, brushColor, hardness);
      drawingCtx.fillStyle = gradient;
      drawingCtx.beginPath();
      drawingCtx.arc(x, y, brushSize, 0, Math.PI * 2);
      drawingCtx.fill();
    }
  } else if (tool === TOOLS.ERASE) {
    drawingCtx.globalCompositeOperation = 'destination-out';
    
    if (hardness >= 95) {
      drawingCtx.fillStyle = 'white';
      drawingCtx.beginPath();
      drawingCtx.arc(x, y, brushSize, 0, Math.PI * 2);
      drawingCtx.fill();
    } else {
      const gradient = createEraserGradient(drawingCtx, x, y, brushSize, hardness);
      drawingCtx.fillStyle = gradient;
      drawingCtx.beginPath();
      drawingCtx.arc(x, y, brushSize, 0, Math.PI * 2);
      drawingCtx.fill();
    }
  }
  
  drawingCtx.restore();
}

/**
 * Рисование точки (обратная совместимость)
 */
export function drawPoint(x, y, tool, brushColor, brushSize, drawingCtx, hardness = 80) {
  if (tool === TOOLS.DRAW && !isPixelInUVMask(x, y)) return;
  drawPointWithHardness(x, y, tool, brushColor, brushSize, drawingCtx, hardness);
}

/**
 * Получение координат на canvas
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