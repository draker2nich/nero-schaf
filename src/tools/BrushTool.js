/**
 * Инструмент "Кисть"
 * Поддерживает:
 * - Размер, жёсткость, прозрачность
 * - Давление планшета
 * - Плавные линии с интерполяцией
 */

import { BaseTool } from './BaseTool';
import { PERFORMANCE } from '../utils/constants';

export class BrushTool extends BaseTool {
  constructor() {
    super({
      name: 'brush',
      cursor: 'crosshair',
      supportsPressure: true
    });
  }

  onPointerDown(point, context) {
    super.onPointerDown(point, context);
    
    const { settings } = context;
    const adjustedSettings = this.applyPressure(settings, point.pressure || 1);
    
    this.drawPoint(point.x, point.y, adjustedSettings, context);
  }

  onPointerMove(point, context) {
    if (!this.isActive || !this.lastPoint) return;
    super.onPointerMove(point, context);

    const { settings } = context;
    
    // Интерполяция для плавных линий
    const density = settings.hardness < 50 
      ? PERFORMANCE.BRUSH_INTERPOLATION_DENSITY.SOFT 
      : PERFORMANCE.BRUSH_INTERPOLATION_DENSITY.HARD;
    
    const points = this.interpolatePoints(this.lastPoint, point, density);
    
    for (const p of points) {
      const adjustedSettings = this.applyPressure(settings, p.pressure);
      this.drawPoint(p.x, p.y, adjustedSettings, context);
    }
    
    this.lastPoint = point;
  }

  drawPoint(x, y, settings, context) {
    const { ctx } = context;
    const { size, color, hardness, opacity } = settings;
    
    ctx.save();
    
    // Применяем прозрачность
    ctx.globalAlpha = opacity / 100;
    
    const rgb = this.parseColor(color);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    
    const h = hardness / 100;
    
    if (h >= 0.99) {
      gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
      gradient.addColorStop(0.99, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
      gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    } else if (h <= 0.01) {
      gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
      gradient.addColorStop(0.15, `rgba(${rgb.r},${rgb.g},${rgb.b},0.9)`);
      gradient.addColorStop(0.3, `rgba(${rgb.r},${rgb.g},${rgb.b},0.65)`);
      gradient.addColorStop(0.45, `rgba(${rgb.r},${rgb.g},${rgb.b},0.4)`);
      gradient.addColorStop(0.6, `rgba(${rgb.r},${rgb.g},${rgb.b},0.2)`);
      gradient.addColorStop(0.75, `rgba(${rgb.r},${rgb.g},${rgb.b},0.08)`);
      gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    } else {
      const solidStop = h * 0.8;
      const fadeLen = 1 - solidStop;
      
      gradient.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
      gradient.addColorStop(solidStop, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
      gradient.addColorStop(solidStop + fadeLen * 0.25, `rgba(${rgb.r},${rgb.g},${rgb.b},0.7)`);
      gradient.addColorStop(solidStop + fadeLen * 0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`);
      gradient.addColorStop(solidStop + fadeLen * 0.75, `rgba(${rgb.r},${rgb.g},${rgb.b},0.1)`);
      gradient.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    }
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  parseColor(color) {
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

  renderPreview(ctx, point, settings) {
    const { size, color, opacity } = settings;
    
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export default BrushTool;
