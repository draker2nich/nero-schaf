/**
 * Инструмент "Ластик"
 */

import { BaseTool } from './BaseTool';
import { PERFORMANCE } from '../utils/constants';

export class EraserTool extends BaseTool {
  constructor() {
    super({
      name: 'eraser',
      cursor: 'crosshair',
      supportsPressure: true
    });
  }

  onPointerDown(point, context) {
    super.onPointerDown(point, context);
    
    const { settings } = context;
    const adjustedSettings = this.applyPressure(settings, point.pressure || 1);
    
    this.erasePoint(point.x, point.y, adjustedSettings, context);
  }

  onPointerMove(point, context) {
    if (!this.isActive || !this.lastPoint) return;
    super.onPointerMove(point, context);

    const { settings } = context;
    
    const density = settings.hardness < 50 
      ? PERFORMANCE.BRUSH_INTERPOLATION_DENSITY.SOFT 
      : PERFORMANCE.BRUSH_INTERPOLATION_DENSITY.HARD;
    
    const points = this.interpolatePoints(this.lastPoint, point, density);
    
    for (const p of points) {
      const adjustedSettings = this.applyPressure(settings, p.pressure);
      this.erasePoint(p.x, p.y, adjustedSettings, context);
    }
    
    this.lastPoint = point;
  }

  erasePoint(x, y, settings, context) {
    if (!this.isPointInBounds(x, y)) return;
    
    const { ctx } = context;
    const { size, hardness, opacity } = settings;
    
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = opacity / 100;
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    const h = hardness / 100;
    
    if (h >= 0.99) {
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.99, 'rgba(255,255,255,1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
    } else if (h <= 0.01) {
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(0.15, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(0.3, 'rgba(255,255,255,0.65)');
      gradient.addColorStop(0.45, 'rgba(255,255,255,0.4)');
      gradient.addColorStop(0.6, 'rgba(255,255,255,0.2)');
      gradient.addColorStop(0.75, 'rgba(255,255,255,0.08)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      const solidStop = h * 0.8;
      const fadeLen = 1 - solidStop;
      
      gradient.addColorStop(0, 'rgba(255,255,255,1)');
      gradient.addColorStop(solidStop, 'rgba(255,255,255,1)');
      gradient.addColorStop(solidStop + fadeLen * 0.25, 'rgba(255,255,255,0.7)');
      gradient.addColorStop(solidStop + fadeLen * 0.5, 'rgba(255,255,255,0.35)');
      gradient.addColorStop(solidStop + fadeLen * 0.75, 'rgba(255,255,255,0.1)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
    }
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

  renderPreview(ctx, point, settings) {
    const { size } = settings;
    
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#666666';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

export default EraserTool;