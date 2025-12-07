import { CANVAS_SIZE, TOOLS } from './constants';

// Кэш для UV маски - создаём один раз
let uvMaskData = null;
let uvMaskWidth = 0;
let uvMaskHeight = 0;

/**
 * Инициализация кэша UV маски для быстрой проверки
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
 * Быстрая проверка пикселя в UV маске через кэш
 */
export function isPixelInUVMask(x, y) {
  if (!uvMaskData) return true;
  
  const ix = Math.round(x);
  const iy = Math.round(y);
  
  if (ix < 0 || ix >= uvMaskWidth || iy < 0 || iy >= uvMaskHeight) {
    return false;
  }
  
  const idx = (iy * uvMaskWidth + ix) * 4 + 3; // альфа-канал
  return uvMaskData[idx] > 0;
}

/**
 * Рисование линии между двумя точками
 */
export function drawLine(x0, y0, x1, y1, tool, brushColor, brushSize, drawingCtx) {
  if (tool === TOOLS.DRAW) {
    drawingCtx.save();
    drawingCtx.lineCap = 'round';
    drawingCtx.lineJoin = 'round';
    drawingCtx.strokeStyle = brushColor;
    drawingCtx.lineWidth = brushSize * 2;
    drawingCtx.beginPath();
    drawingCtx.moveTo(x0, y0);
    drawingCtx.lineTo(x1, y1);
    drawingCtx.stroke();
    drawingCtx.restore();
  } else if (tool === TOOLS.ERASE) {
    drawingCtx.save();
    drawingCtx.globalCompositeOperation = 'destination-out';
    drawingCtx.lineCap = 'round';
    drawingCtx.lineJoin = 'round';
    drawingCtx.strokeStyle = 'white';
    drawingCtx.lineWidth = brushSize * 2;
    drawingCtx.beginPath();
    drawingCtx.moveTo(x0, y0);
    drawingCtx.lineTo(x1, y1);
    drawingCtx.stroke();
    drawingCtx.restore();
  }
}

/**
 * Рисование точки
 */
export function drawPoint(x, y, tool, brushColor, brushSize, drawingCtx) {
  if (tool === TOOLS.DRAW) {
    if (!isPixelInUVMask(x, y)) return;
    
    drawingCtx.save();
    drawingCtx.fillStyle = brushColor;
    drawingCtx.beginPath();
    drawingCtx.arc(x, y, brushSize, 0, Math.PI * 2);
    drawingCtx.fill();
    drawingCtx.restore();
  } else if (tool === TOOLS.ERASE) {
    drawingCtx.save();
    drawingCtx.globalCompositeOperation = 'destination-out';
    drawingCtx.beginPath();
    drawingCtx.arc(x, y, brushSize, 0, Math.PI * 2);
    drawingCtx.fill();
    drawingCtx.restore();
  }
}

/**
 * Получение координат на canvas из события мыши/touch
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
 * Расстояние между двумя точками
 */
export function getDistance(x1, y1, x2, y2) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * Применение UV маски к canvas
 */
export function applyUVMask(canvas, uvLayoutImage) {
  if (!uvLayoutImage) return;
  
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.restore();
}