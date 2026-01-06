/**
 * Высококачественный рендерер штрихов
 * Рендерит векторные данные в нужном разрешении
 */

import { CANVAS_SIZE, TOOLS, PERFORMANCE } from './constants';

/**
 * Парсинг цвета в RGB
 */
function parseColor(color) {
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
  return { r: 0, g: 0, b: 0 };
}

/**
 * Интерполяция точек для плавных линий
 */
function interpolatePoints(p1, p2, density = 0.25) {
  const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  const steps = Math.max(1, Math.ceil(dist * density));
  const points = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
      pressure: (p1.pressure || 1) + ((p2.pressure || 1) - (p1.pressure || 1)) * t
    });
  }

  return points;
}

/**
 * Рисование одной точки кисти
 */
function drawBrushPoint(ctx, x, y, size, color, hardness, opacity, pressure = 1) {
  const rgb = parseColor(color);
  const { r, g, b } = rgb;
  
  // Применяем давление к размеру
  const actualSize = size * (0.3 + 0.7 * pressure);
  
  ctx.save();
  ctx.globalAlpha = (opacity / 100) * (0.5 + 0.5 * pressure);
  
  const h = hardness / 100;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, actualSize);
  
  if (h >= 0.99) {
    gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
    gradient.addColorStop(0.95, `rgba(${r},${g},${b},1)`);
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
  ctx.beginPath();
  ctx.arc(x, y, actualSize, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Рисование точки ластика
 */
function drawEraserPoint(ctx, x, y, size, hardness, opacity, pressure = 1) {
  const actualSize = size * (0.3 + 0.7 * pressure);
  
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.globalAlpha = (opacity / 100) * (0.5 + 0.5 * pressure);
  
  const h = hardness / 100;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, actualSize);
  
  if (h >= 0.99) {
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.95, 'rgba(255,255,255,1)');
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
  ctx.beginPath();
  ctx.arc(x, y, actualSize, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
}

/**
 * Рендеринг одного штриха
 */
export function renderStroke(ctx, stroke, targetSize, uvMaskData = null) {
  if (!stroke || stroke.points.length === 0) return;
  
  const scale = targetSize / CANVAS_SIZE;
  const scaledSize = stroke.size * scale;
  const points = stroke.getPointsAtSize(targetSize);
  
  const density = stroke.hardness < 50 
    ? PERFORMANCE.BRUSH_INTERPOLATION_DENSITY.SOFT 
    : PERFORMANCE.BRUSH_INTERPOLATION_DENSITY.HARD;

  // Рисуем первую точку
  if (stroke.tool === TOOLS.DRAW) {
    drawBrushPoint(ctx, points[0].x, points[0].y, scaledSize, 
      stroke.color, stroke.hardness, stroke.opacity, points[0].pressure);
  } else if (stroke.tool === TOOLS.ERASE) {
    drawEraserPoint(ctx, points[0].x, points[0].y, scaledSize, 
      stroke.hardness, stroke.opacity, points[0].pressure);
  }

  // Интерполируем и рисуем остальные точки
  for (let i = 1; i < points.length; i++) {
    const interpolated = interpolatePoints(points[i - 1], points[i], density / scale);
    
    for (const p of interpolated) {
      if (stroke.tool === TOOLS.DRAW) {
        drawBrushPoint(ctx, p.x, p.y, scaledSize, 
          stroke.color, stroke.hardness, stroke.opacity, p.pressure);
      } else if (stroke.tool === TOOLS.ERASE) {
        drawEraserPoint(ctx, p.x, p.y, scaledSize, 
          stroke.hardness, stroke.opacity, p.pressure);
      }
    }
  }
}

/**
 * Рендеринг всех штрихов менеджера
 */
export function renderAllStrokes(ctx, strokeManager, targetSize, uvMaskData = null) {
  if (!strokeManager) return;
  
  // Рендерим сохранённые штрихи
  for (const stroke of strokeManager.strokes) {
    renderStroke(ctx, stroke, targetSize, uvMaskData);
  }
  
  // Рендерим текущий штрих (если есть)
  if (strokeManager.currentStroke) {
    renderStroke(ctx, strokeManager.currentStroke, targetSize, uvMaskData);
  }
}

/**
 * Создание высококачественного рендера слоя
 */
export function createHiResRender(strokeManager, targetSize, uvLayoutImage = null) {
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d', { alpha: true });
  
  // Рендерим все штрихи
  renderAllStrokes(ctx, strokeManager, targetSize);
  
  // Применяем UV маску если есть
  if (uvLayoutImage) {
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(uvLayoutImage, 0, 0, targetSize, targetSize);
    ctx.globalCompositeOperation = 'source-over';
  }
  
  return canvas;
}

/**
 * Адаптивный рендер - выбирает разрешение на основе зума
 */
export function getAdaptiveResolution(zoom, baseSize = CANVAS_SIZE) {
  // Пороги для разных разрешений
  if (zoom <= 1.5) return baseSize;
  if (zoom <= 2) return baseSize * 2;
  if (zoom <= 3) return Math.min(baseSize * 3, 3072);
  return Math.min(baseSize * 4, 4096);
}

/**
 * Проверка необходимости HiRes рендера
 */
export function needsHiResRender(zoom) {
  return zoom > 1.5;
}

export default {
  renderStroke,
  renderAllStrokes,
  createHiResRender,
  getAdaptiveResolution
};