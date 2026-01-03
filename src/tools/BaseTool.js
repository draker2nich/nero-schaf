/**
 * Базовый класс инструмента
 * Все инструменты наследуются от этого класса
 * 
 * Apple-like архитектура:
 * - Единый интерфейс для всех инструментов
 * - Поддержка давления планшета
 * - Легко расширяется новыми инструментами
 */

export class BaseTool {
  constructor(options = {}) {
    this.name = options.name || 'tool';
    this.icon = options.icon || null;
    this.cursor = options.cursor || 'crosshair';
    this.supportsPressure = options.supportsPressure || false;
    
    // Состояние инструмента
    this.isActive = false;
    this.lastPoint = null;
    this.pressure = 1.0;
  }

  /**
   * Вызывается при выборе инструмента
   */
  onSelect(context) {
    // Override в наследниках
  }

  /**
   * Вызывается при смене на другой инструмент
   */
  onDeselect(context) {
    this.isActive = false;
    this.lastPoint = null;
  }

  /**
   * Начало действия (mousedown/touchstart)
   * @param {Object} point - { x, y, pressure }
   * @param {Object} context - { layer, canvas, ctx, settings }
   */
  onPointerDown(point, context) {
    this.isActive = true;
    this.lastPoint = point;
    this.pressure = point.pressure || 1.0;
  }

  /**
   * Движение (mousemove/touchmove)
   * @param {Object} point - { x, y, pressure }
   * @param {Object} context - { layer, canvas, ctx, settings }
   */
  onPointerMove(point, context) {
    if (!this.isActive) return;
    this.pressure = point.pressure || 1.0;
  }

  /**
   * Окончание действия (mouseup/touchend)
   * @param {Object} point - { x, y }
   * @param {Object} context - { layer, canvas, ctx, settings }
   */
  onPointerUp(point, context) {
    this.isActive = false;
    this.lastPoint = null;
  }

  /**
   * Отмена действия (escape, потеря фокуса)
   */
  onCancel(context) {
    this.isActive = false;
    this.lastPoint = null;
  }

  /**
   * Отрисовка превью/курсора
   * @param {CanvasRenderingContext2D} ctx - контекст для превью
   * @param {Object} point - текущая позиция
   * @param {Object} settings - настройки инструмента
   */
  renderPreview(ctx, point, settings) {
    // Override в наследниках
  }

  /**
   * Получение настроек с учётом давления
   * @param {Object} settings - базовые настройки
   * @param {number} pressure - давление (0-1)
   * @returns {Object} - модифицированные настройки
   */
  applyPressure(settings, pressure) {
    if (!this.supportsPressure || pressure === 1.0) {
      return settings;
    }

    const { PRESSURE_SETTINGS } = require('../utils/constants');
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

  /**
   * Расстояние между двумя точками
   */
  getDistance(p1, p2) {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  /**
   * Интерполяция между точками для плавных линий
   */
  interpolatePoints(p1, p2, density = 0.25) {
    const dist = this.getDistance(p1, p2);
    const steps = Math.max(1, Math.ceil(dist * density));
    const points = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      points.push({
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t,
        pressure: p1.pressure + ((p2.pressure || 1) - (p1.pressure || 1)) * t
      });
    }

    return points;
  }
}

export default BaseTool;
