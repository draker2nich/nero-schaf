/**
 * Базовый класс инструмента
 * Все инструменты наследуются от этого класса
 */

import { PRESSURE_SETTINGS, CANVAS_SIZE } from '../utils/constants';

export class BaseTool {
  constructor(options = {}) {
    this.name = options.name || 'tool';
    this.icon = options.icon || null;
    this.cursor = options.cursor || 'crosshair';
    this.supportsPressure = options.supportsPressure || false;
    
    this.isActive = false;
    this.lastPoint = null;
    this.pressure = 1.0;
  }

  onSelect(context) {}

  onDeselect(context) {
    this.isActive = false;
    this.lastPoint = null;
  }

  onPointerDown(point, context) {
    this.isActive = true;
    this.lastPoint = point;
    this.pressure = point.pressure || 1.0;
  }

  onPointerMove(point, context) {
    if (!this.isActive) return;
    this.pressure = point.pressure || 1.0;
  }

  onPointerUp(point, context) {
    this.isActive = false;
    this.lastPoint = null;
  }

  onCancel(context) {
    this.isActive = false;
    this.lastPoint = null;
  }

  renderPreview(ctx, point, settings) {}

  applyPressure(settings, pressure) {
    if (!this.supportsPressure || pressure === 1.0) {
      return settings;
    }

    const result = { ...settings };

    if (PRESSURE_SETTINGS.AFFECTS_SIZE && settings.size) {
      const sizeMultiplier = PRESSURE_SETTINGS.MIN_SIZE_MULTIPLIER + 
        (PRESSURE_SETTINGS.MAX_SIZE_MULTIPLIER - PRESSURE_SETTINGS.MIN_SIZE_MULTIPLIER) * pressure;
      result.size = Math.max(1, Math.round(settings.size * sizeMultiplier));
    }

    if (PRESSURE_SETTINGS.AFFECTS_OPACITY && settings.opacity) {
      const opacityMultiplier = PRESSURE_SETTINGS.MIN_OPACITY_MULTIPLIER +
        (PRESSURE_SETTINGS.MAX_OPACITY_MULTIPLIER - PRESSURE_SETTINGS.MIN_OPACITY_MULTIPLIER) * pressure;
      result.opacity = Math.max(1, Math.round(settings.opacity * opacityMultiplier));
    }

    return result;
  }

  getDistance(p1, p2) {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  interpolatePoints(p1, p2, density = 0.25) {
    const dist = this.getDistance(p1, p2);
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

  isPointInBounds(x, y) {
    return x >= 0 && x < CANVAS_SIZE && y >= 0 && y < CANVAS_SIZE;
  }
}

export default BaseTool;