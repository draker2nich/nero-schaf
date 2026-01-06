/**
 * Инструмент "Штамп" (Clone Stamp)
 * 
 * Функционал:
 * - Копирует видимую текстуру со ВСЕХ слоёв КРОМЕ базового (фонового)
 * - Включает: рисунки, загруженные изображения, AI-генерации
 * - Корректная работа с UV-маской
 */

import { BaseTool } from './BaseTool';
import { CANVAS_SIZE, PERFORMANCE } from '../utils/constants';

export class StampTool extends BaseTool {
  constructor() {
    super({
      name: 'stamp',
      cursor: 'crosshair',
      supportsPressure: true
    });
    
    this.sourcePoint = null;
    this.offset = { x: 0, y: 0 };
    this.firstDrawPoint = null;
    this.sourceImageData = null;
    this.uvMaskData = null;
    this.needsCacheUpdate = true;
  }

  onSelect(context) {
    this.needsCacheUpdate = true;
  }

  onDeselect(context) {
    super.onDeselect(context);
  }

  /**
   * Установка источника клонирования
   */
  setSource(point, context) {
    const x = Math.round(point.x);
    const y = Math.round(point.y);
    
    if (x < 0 || x >= CANVAS_SIZE || y < 0 || y >= CANVAS_SIZE) {
      return false;
    }
    
    this.sourcePoint = { x, y };
    this.firstDrawPoint = null;
    this.offset = { x: 0, y: 0 };
    this.needsCacheUpdate = true;
    
    // Кэшируем изображение БЕЗ базового слоя
    this.cacheSourceImage(context);
    
    // Сохраняем UV-маску
    if (context.uvMaskData) {
      this.uvMaskData = context.uvMaskData;
    }
    
    return true;
  }

  invalidateCache() {
    this.needsCacheUpdate = true;
    this.sourceImageData = null;
  }

  /**
   * Кэширование изображения - ВСЕ слои КРОМЕ базового (type !== 'base')
   * Включает: рисунки, загруженные изображения, AI-генерации
   */
  cacheSourceImage(context) {
    const { layers } = context;
    
    if (!layers || layers.length === 0) {
      console.warn('StampTool: no layers available');
      return;
    }
    
    // Создаём временный canvas для композитинга
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_SIZE;
    tempCanvas.height = CANVAS_SIZE;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
    
    // Очищаем с прозрачным фоном
    tempCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // Рисуем ВСЕ видимые слои КРОМЕ базового (фонового)
    // Это включает: drawing, image (загруженные и AI-сгенерированные)
    layers.forEach(layer => {
      if (layer.visible && layer.canvas && layer.type !== 'base') {
        tempCtx.globalAlpha = layer.opacity || 1;
        tempCtx.drawImage(layer.canvas, 0, 0);
      }
    });
    tempCtx.globalAlpha = 1;
    
    try {
      this.sourceImageData = tempCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
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

  /**
   * Проверка, находится ли точка в UV-маске
   * Координаты уже в canvas-пространстве (0 - CANVAS_SIZE)
   */
  isInUVMask(x, y) {
    // Если UV-маска не загружена - разрешаем рисовать везде
    if (!this.uvMaskData) {
      return true;
    }
    
    const ix = Math.round(x);
    const iy = Math.round(y);
    
    // Проверяем границы canvas
    if (ix < 0 || ix >= CANVAS_SIZE || iy < 0 || iy >= CANVAS_SIZE) {
      return false;
    }
    
    // Проверяем Alpha канал UV-маски
    // UV-маска имеет белые области там где можно рисовать
    const idx = (iy * CANVAS_SIZE + ix) * 4 + 3;
    const alpha = this.uvMaskData[idx];
    
    // Порог > 10 для учёта антиалиасинга краёв
    return alpha > 10;
  }

  onPointerDown(point, context) {
    // Сохраняем UV-маску из контекста
    if (context.uvMaskData) {
      this.uvMaskData = context.uvMaskData;
    }
    
    // Проверка Alt+Click для установки источника (desktop)
    if (context.altKey) {
      const result = this.setSource(point, context);
      if (result && context.onSourceSet) {
        context.onSourceSet(point);
      }
      return { sourceSet: result };
    }
    
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
    // Инвалидируем кэш после рисования
    this.needsCacheUpdate = true;
  }

  onCancel(context) {
    super.onCancel(context);
  }

  stampPoint(x, y, settings, context) {
    if (!this.sourceImageData) return;
    
    // Проверяем UV-маску для центральной точки
    // x, y уже в canvas-координатах (0 - CANVAS_SIZE)
    if (!this.isInUVMask(x, y)) return;
    
    const { ctx } = context;
    const { size, hardness, opacity } = settings;
    
    // Позиция источника с учётом смещения
    const sourceX = Math.round(x + this.offset.x);
    const sourceY = Math.round(y + this.offset.y);
    
    ctx.save();
    
    // Размер временного canvas
    const tempSize = Math.ceil(size * 2 + 4);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = tempSize;
    tempCanvas.height = tempSize;
    const tempCtx = tempCanvas.getContext('2d');
    
    const centerX = tempSize / 2;
    const centerY = tempSize / 2;
    
    // Копируем область из источника
    const srcLeft = sourceX - Math.floor(tempSize / 2);
    const srcTop = sourceY - Math.floor(tempSize / 2);
    
    // Создаём ImageData для временного canvas
    const destImageData = tempCtx.createImageData(tempSize, tempSize);
    const srcData = this.sourceImageData.data;
    const destData = destImageData.data;
    
    for (let dy = 0; dy < tempSize; dy++) {
      for (let dx = 0; dx < tempSize; dx++) {
        const srcPx = srcLeft + dx;
        const srcPy = srcTop + dy;
        
        // Проверяем границы источника
        if (srcPx >= 0 && srcPx < CANVAS_SIZE && srcPy >= 0 && srcPy < CANVAS_SIZE) {
          const srcIdx = (srcPy * CANVAS_SIZE + srcPx) * 4;
          const destIdx = (dy * tempSize + dx) * 4;
          
          // Копируем только если есть непрозрачные пиксели
          const alpha = srcData[srcIdx + 3];
          if (alpha > 0) {
            destData[destIdx] = srcData[srcIdx];
            destData[destIdx + 1] = srcData[srcIdx + 1];
            destData[destIdx + 2] = srcData[srcIdx + 2];
            destData[destIdx + 3] = alpha;
          }
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
      gradient.addColorStop(0.95, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
    } else if (h <= 0.01) {
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
      gradient.addColorStop(0.4, 'rgba(255,255,255,0.5)');
      gradient.addColorStop(0.6, 'rgba(255,255,255,0.25)');
      gradient.addColorStop(0.8, 'rgba(255,255,255,0.1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      const solidStop = h * 0.85;
      const fadeLen = 1 - solidStop;
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(solidStop, 'rgba(255,255,255,1)');
      gradient.addColorStop(solidStop + fadeLen * 0.3, 'rgba(255,255,255,0.6)');
      gradient.addColorStop(solidStop + fadeLen * 0.6, 'rgba(255,255,255,0.2)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
    }
    
    tempCtx.fillStyle = gradient;
    tempCtx.beginPath();
    tempCtx.arc(centerX, centerY, size + 1, 0, Math.PI * 2);
    tempCtx.fill();
    
    // Применяем UV-маску к временному изображению
    if (this.uvMaskData) {
      this.applyUVMaskToTemp(tempCtx, Math.round(x - centerX), Math.round(y - centerY), tempSize);
    }
    
    // Рисуем на целевой canvas с учётом прозрачности
    ctx.globalAlpha = opacity / 100;
    ctx.drawImage(tempCanvas, Math.round(x - centerX), Math.round(y - centerY));
    
    ctx.restore();
  }

  /**
   * Применение UV-маски к временному canvas
   */
  applyUVMaskToTemp(tempCtx, offsetX, offsetY, size) {
    if (!this.uvMaskData) return;
    
    const imageData = tempCtx.getImageData(0, 0, size, size);
    const data = imageData.data;
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const canvasX = offsetX + x;
        const canvasY = offsetY + y;
        
        // Проверяем границы canvas
        if (canvasX < 0 || canvasX >= CANVAS_SIZE || canvasY < 0 || canvasY >= CANVAS_SIZE) {
          const idx = (y * size + x) * 4;
          data[idx + 3] = 0;
          continue;
        }
        
        // Проверяем UV-маску (alpha канал)
        const uvIdx = (canvasY * CANVAS_SIZE + canvasX) * 4 + 3;
        if (this.uvMaskData[uvIdx] <= 10) {
          const idx = (y * size + x) * 4;
          data[idx + 3] = 0;
        }
      }
    }
    
    tempCtx.putImageData(imageData, 0, 0);
  }

  renderPreview(previewCtx, point, settings, context) {
    const { size } = settings;
    
    previewCtx.save();
    
    // Превью курсора (зелёный круг)
    previewCtx.globalAlpha = 0.6;
    previewCtx.strokeStyle = '#00cc00';
    previewCtx.lineWidth = 2;
    previewCtx.setLineDash([5, 5]);
    previewCtx.beginPath();
    previewCtx.arc(point.x, point.y, size, 0, Math.PI * 2);
    previewCtx.stroke();
    
    // Показываем источник если установлен
    if (this.hasSource()) {
      // Крестик на исходной точке источника
      previewCtx.strokeStyle = '#ff6600';
      previewCtx.setLineDash([]);
      previewCtx.lineWidth = 2;
      previewCtx.beginPath();
      previewCtx.moveTo(this.sourcePoint.x - 12, this.sourcePoint.y);
      previewCtx.lineTo(this.sourcePoint.x + 12, this.sourcePoint.y);
      previewCtx.moveTo(this.sourcePoint.x, this.sourcePoint.y - 12);
      previewCtx.lineTo(this.sourcePoint.x, this.sourcePoint.y + 12);
      previewCtx.stroke();
      
      // Если уже начали рисовать - показываем текущий источник
      if (this.firstDrawPoint) {
        const sourceX = point.x + this.offset.x;
        const sourceY = point.y + this.offset.y;
        
        if (sourceX >= 0 && sourceX < CANVAS_SIZE && sourceY >= 0 && sourceY < CANVAS_SIZE) {
          // Красный круг - откуда берём
          previewCtx.globalAlpha = 0.5;
          previewCtx.strokeStyle = '#ff0000';
          previewCtx.setLineDash([2, 2]);
          previewCtx.beginPath();
          previewCtx.arc(sourceX, sourceY, size, 0, Math.PI * 2);
          previewCtx.stroke();
          
          // Линия между источником и целью
          previewCtx.globalAlpha = 0.3;
          previewCtx.beginPath();
          previewCtx.moveTo(sourceX, sourceY);
          previewCtx.lineTo(point.x, point.y);
          previewCtx.stroke();
        }
      }
    }
    
    previewCtx.restore();
  }
}

export default StampTool;