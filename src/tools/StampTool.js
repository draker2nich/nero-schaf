/**
 * Инструмент "Штамп" (Clone Stamp)
 * 
 * Использование:
 * 1. Alt+Click для выбора источника
 * 2. Рисование для клонирования области
 * 
 * Поддерживает:
 * - Размер, жёсткость, прозрачность
 * - Давление планшета
 * - Смещение относительно источника
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
    
    // Позиция источника клонирования
    this.sourcePoint = null;
    // Смещение от источника
    this.offset = { x: 0, y: 0 };
    // Флаг установки источника
    this.settingSource = false;
    // Первая точка рисования (для вычисления offset)
    this.firstDrawPoint = null;
    // Кэш изображения источника
    this.sourceImageData = null;
  }

  onSelect(context) {
    // Сброс источника при выборе инструмента
    // this.sourcePoint = null; // Можно оставить источник между использованиями
  }

  /**
   * Установка источника клонирования
   * @param {Object} point - { x, y }
   * @param {Object} context - контекст
   */
  setSource(point, context) {
    this.sourcePoint = { x: point.x, y: point.y };
    this.firstDrawPoint = null;
    this.offset = { x: 0, y: 0 };
    
    // Кэшируем изображение для производительности
    this.cacheSourceImage(context);
    
    return true;
  }

  cacheSourceImage(context) {
    const { compositeCanvas } = context;
    if (!compositeCanvas) return;
    
    const compositeCtx = compositeCanvas.getContext('2d');
    this.sourceImageData = compositeCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  hasSource() {
    return this.sourcePoint !== null;
  }

  getSourcePoint() {
    return this.sourcePoint;
  }

  onPointerDown(point, context) {
    // Если нет источника, показываем сообщение
    if (!this.hasSource()) {
      return { needSource: true };
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

  stampPoint(x, y, settings, context) {
    if (!this.sourceImageData) return;
    
    const { ctx } = context;
    const { size, hardness, opacity } = settings;
    
    // Позиция источника с учётом смещения
    const sourceX = x + this.offset.x;
    const sourceY = y + this.offset.y;
    
    ctx.save();
    ctx.globalAlpha = opacity / 100;
    
    // Создаём временный canvas для маскирования
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size * 2 + 4;
    tempCanvas.height = size * 2 + 4;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Центр временного canvas
    const centerX = size + 2;
    const centerY = size + 2;
    
    // Копируем область из источника
    const srcLeft = Math.round(sourceX - size - 2);
    const srcTop = Math.round(sourceY - size - 2);
    
    // Рисуем пиксели из кэшированного изображения
    const destImageData = tempCtx.createImageData(tempCanvas.width, tempCanvas.height);
    
    for (let dy = 0; dy < tempCanvas.height; dy++) {
      for (let dx = 0; dx < tempCanvas.width; dx++) {
        const srcPx = srcLeft + dx;
        const srcPy = srcTop + dy;
        
        if (srcPx >= 0 && srcPx < CANVAS_SIZE && srcPy >= 0 && srcPy < CANVAS_SIZE) {
          const srcIdx = (srcPy * CANVAS_SIZE + srcPx) * 4;
          const destIdx = (dy * tempCanvas.width + dx) * 4;
          
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
    
    // Рисуем на целевой canvas
    ctx.drawImage(tempCanvas, x - centerX, y - centerY);
    
    ctx.restore();
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
    if (this.hasSource()) {
      const sourceX = point.x + this.offset.x;
      const sourceY = point.y + this.offset.y;
      
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
      
      // Крестик на источнике
      previewCtx.setLineDash([]);
      previewCtx.beginPath();
      previewCtx.moveTo(sourceX - 8, sourceY);
      previewCtx.lineTo(sourceX + 8, sourceY);
      previewCtx.moveTo(sourceX, sourceY - 8);
      previewCtx.lineTo(sourceX, sourceY + 8);
      previewCtx.stroke();
    }
    
    previewCtx.restore();
  }
}

export default StampTool;