/**
 * Инструмент "Штамп" (Clone Stamp)
 * 
 * Исправления:
 * - Применение UV-маски (не рисует за пределами)
 * - Корректное обновление кэша при изменении слоёв
 * - Правильная работа со смещением
 * - Ограничение рисования границами холста
 */

import { BaseTool } from './BaseTool';
import { CANVAS_SIZE, PERFORMANCE } from '../utils/constants';
import { isPixelInUVMask } from '../utils/drawingUtils';

export class StampTool extends BaseTool {
  constructor() {
    super({
      name: 'stamp',
      cursor: 'crosshair',
      supportsPressure: true
    });
    
    // Позиция источника клонирования
    this.sourcePoint = null;
    // Смещение от источника
    this.offset = { x: 0, y: 0 };
    // Первая точка рисования (для вычисления offset)
    this.firstDrawPoint = null;
    // Кэш изображения источника
    this.sourceImageData = null;
    // Флаг необходимости обновления кэша
    this.needsCacheUpdate = true;
  }

  onSelect(context) {
    // Помечаем что нужно обновить кэш при следующем использовании
    this.needsCacheUpdate = true;
  }

  /**
   * Установка источника клонирования
   */
  setSource(point, context) {
    // Проверяем что точка в пределах холста
    if (point.x < 0 || point.x >= CANVAS_SIZE || point.y < 0 || point.y >= CANVAS_SIZE) {
      return false;
    }
    
    this.sourcePoint = { x: point.x, y: point.y };
    this.firstDrawPoint = null;
    this.offset = { x: 0, y: 0 };
    this.needsCacheUpdate = true;
    
    // Кэшируем изображение
    this.cacheSourceImage(context);
    
    return true;
  }

  /**
   * Принудительное обновление кэша
   */
  invalidateCache() {
    this.needsCacheUpdate = true;
    this.sourceImageData = null;
  }

  cacheSourceImage(context) {
    const { compositeCanvas } = context;
    if (!compositeCanvas) {
      console.warn('StampTool: compositeCanvas not available');
      return;
    }
    
    try {
      const compositeCtx = compositeCanvas.getContext('2d');
      this.sourceImageData = compositeCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      this.needsCacheUpdate = false;
    } catch (e) {
      console.error('StampTool: failed to cache source image', e);
      this.sourceImageData = null;
    }
  }

  hasSource() {
    return this.sourcePoint !== null;
  }

  getSourcePoint() {
    return this.sourcePoint ? { ...this.sourcePoint } : null;
  }

  onPointerDown(point, context) {
    // Если нет источника, показываем сообщение
    if (!this.hasSource()) {
      return { needSource: true };
    }
    
    // Обновляем кэш если нужно
    if (this.needsCacheUpdate || !this.sourceImageData) {
      this.cacheSourceImage(context);
    }
    
    super.onPointerDown(point, context);
    
    // Вычисляем offset при первом клике
    if (!this.firstDrawPoint) {
      this.firstDrawPoint = { x: point.x, y: point.y };
      this.offset = {
        x: this.sourcePoint.x - point.x,
        y: this.sourcePoint.y - point.y
      };
    }
    
    const { settings } = context;
    const adjustedSettings = this.applyPressure(settings, point.pressure || 1);
    
    this.stampPoint(point.x, point.y, adjustedSettings, context);
  }

  onPointerMove(point, context) {
    if (!this.isActive || !this.lastPoint || !this.hasSource()) return;
    super.onPointerMove(point, context);

    const { settings } = context;
    
    const density = settings.hardness < 50 
      ? PERFORMANCE.BRUSH_INTERPOLATION_DENSITY.SOFT 
      : PERFORMANCE.BRUSH_INTERPOLATION_DENSITY.HARD;
    
    const points = this.interpolatePoints(this.lastPoint, point, density);
    
    for (const p of points) {
      const adjustedSettings = this.applyPressure(settings, p.pressure);
      this.stampPoint(p.x, p.y, adjustedSettings, context);
    }
    
    this.lastPoint = point;
  }

  onPointerUp(point, context) {
    super.onPointerUp(point, context);
    // После окончания рисования помечаем что нужно обновить кэш
    this.needsCacheUpdate = true;
  }

  stampPoint(x, y, settings, context) {
    if (!this.sourceImageData) return;
    
    // Проверяем что центр штампа попадает в UV-маску
    if (!isPixelInUVMask(x, y)) return;
    
    // Проверяем границы холста
    if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) return;
    
    const { ctx } = context;
    const { size, hardness, opacity } = settings;
    
    // Позиция источника с учётом смещения
    const sourceX = x + this.offset.x;
    const sourceY = y + this.offset.y;
    
    // Проверяем что источник в пределах холста
    if (sourceX < 0 || sourceX >= CANVAS_SIZE || sourceY < 0 || sourceY >= CANVAS_SIZE) return;
    
    ctx.save();
    ctx.globalAlpha = opacity / 100;
    
    // Размер временного canvas с запасом
    const tempSize = Math.ceil(size * 2 + 4);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = tempSize;
    tempCanvas.height = tempSize;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Центр временного canvas
    const centerX = tempSize / 2;
    const centerY = tempSize / 2;
    
    // Копируем область из источника
    const srcLeft = Math.round(sourceX - size - 2);
    const srcTop = Math.round(sourceY - size - 2);
    
    // Создаём ImageData для временного canvas
    const destImageData = tempCtx.createImageData(tempSize, tempSize);
    
    for (let dy = 0; dy < tempSize; dy++) {
      for (let dx = 0; dx < tempSize; dx++) {
        const srcPx = srcLeft + dx;
        const srcPy = srcTop + dy;
        
        // Проверяем границы источника
        if (srcPx >= 0 && srcPx < CANVAS_SIZE && srcPy >= 0 && srcPy < CANVAS_SIZE) {
          const srcIdx = (srcPy * CANVAS_SIZE + srcPx) * 4;
          const destIdx = (dy * tempSize + dx) * 4;
          
          destImageData.data[destIdx] = this.sourceImageData.data[srcIdx];
          destImageData.data[destIdx + 1] = this.sourceImageData.data[srcIdx + 1];
          destImageData.data[destIdx + 2] = this.sourceImageData.data[srcIdx + 2];
          destImageData.data[destIdx + 3] = this.sourceImageData.data[srcIdx + 3];
        }
      }
    }
    
    tempCtx.putImageData(destImageData, 0, 0);
    
    // Применяем круглую маску с учётом жёсткости
    tempCtx.globalCompositeOperation = 'destination-in';
    
    const gradient = tempCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, size);
    const h = hardness / 100;
    
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
    
    tempCtx.fillStyle = gradient;
    tempCtx.beginPath();
    tempCtx.arc(centerX, centerY, size, 0, Math.PI * 2);
    tempCtx.fill();
    
    // Применяем UV-маску к временному canvas
    tempCtx.globalCompositeOperation = 'destination-in';
    this.applyUVMaskToTemp(tempCtx, x - centerX, y - centerY, tempSize);
    
    // Рисуем на целевой canvas
    ctx.drawImage(tempCanvas, x - centerX, y - centerY);
    
    ctx.restore();
  }

  /**
   * Применение UV-маски к временному canvas
   */
  applyUVMaskToTemp(tempCtx, offsetX, offsetY, size) {
    const imageData = tempCtx.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const canvasX = offsetX + x;
        const canvasY = offsetY + y;
        
        // Если пиксель за пределами UV-маски, делаем его прозрачным
        if (!isPixelInUVMask(canvasX, canvasY)) {
          const idx = (y * size + x) * 4;
          data[idx + 3] = 0; // Alpha = 0
        }
      }
    }
    
    tempCtx.putImageData(imageData, 0, 0);
  }

  renderPreview(previewCtx, point, settings, context) {
    const { size } = settings;
    
    previewCtx.save();
    
    // Превью курсора
    previewCtx.globalAlpha = 0.5;
    previewCtx.strokeStyle = '#00aa00';
    previewCtx.lineWidth = 2;
    previewCtx.setLineDash([4, 4]);
    previewCtx.beginPath();
    previewCtx.arc(point.x, point.y, size, 0, Math.PI * 2);
    previewCtx.stroke();
    
    // Показываем источник если установлен
    if (this.hasSource() && this.firstDrawPoint) {
      const sourceX = point.x + this.offset.x;
      const sourceY = point.y + this.offset.y;
      
      // Проверяем что источник в пределах холста
      if (sourceX >= 0 && sourceX < CANVAS_SIZE && sourceY >= 0 && sourceY < CANVAS_SIZE) {
        previewCtx.strokeStyle = '#ff0000';
        previewCtx.setLineDash([2, 2]);
        previewCtx.beginPath();
        previewCtx.arc(sourceX, sourceY, size, 0, Math.PI * 2);
        previewCtx.stroke();
        
        // Линия между источником и целью
        previewCtx.beginPath();
        previewCtx.moveTo(sourceX, sourceY);
        previewCtx.lineTo(point.x, point.y);
        previewCtx.stroke();
      }
      
      // Крестик на исходной точке источника
      previewCtx.strokeStyle = '#ff6600';
      previewCtx.setLineDash([]);
      previewCtx.beginPath();
      previewCtx.moveTo(this.sourcePoint.x - 8, this.sourcePoint.y);
      previewCtx.lineTo(this.sourcePoint.x + 8, this.sourcePoint.y);
      previewCtx.moveTo(this.sourcePoint.x, this.sourcePoint.y - 8);
      previewCtx.lineTo(this.sourcePoint.x, this.sourcePoint.y + 8);
      previewCtx.stroke();
    } else if (this.hasSource()) {
      // Показываем только исходную точку если ещё не начали рисовать
      previewCtx.strokeStyle = '#ff6600';
      previewCtx.setLineDash([]);
      previewCtx.lineWidth = 2;
      previewCtx.beginPath();
      previewCtx.moveTo(this.sourcePoint.x - 10, this.sourcePoint.y);
      previewCtx.lineTo(this.sourcePoint.x + 10, this.sourcePoint.y);
      previewCtx.moveTo(this.sourcePoint.x, this.sourcePoint.y - 10);
      previewCtx.lineTo(this.sourcePoint.x, this.sourcePoint.y + 10);
      previewCtx.stroke();
      
      // Круг вокруг источника
      previewCtx.setLineDash([4, 4]);
      previewCtx.beginPath();
      previewCtx.arc(this.sourcePoint.x, this.sourcePoint.y, size, 0, Math.PI * 2);
      previewCtx.stroke();
    }
    
    previewCtx.restore();
  }
}

export default StampTool;