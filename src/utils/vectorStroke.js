/**
 * Система векторного хранения штрихов
 * Позволяет перерисовывать в любом разрешении без потери качества
 */

import { CANVAS_SIZE } from './constants';

/**
 * Класс для хранения одного штриха
 */
export class VectorStroke {
  constructor(options = {}) {
    this.id = `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.tool = options.tool || 'draw';
    this.color = options.color || '#000000';
    this.size = options.size || 15;
    this.hardness = options.hardness ?? 80;
    this.opacity = options.opacity ?? 100;
    this.points = []; // Нормализованные координаты 0-1
    this.bounds = null;
  }

  /**
   * Добавление точки (нормализуем к 0-1)
   */
  addPoint(x, y, pressure = 1) {
    this.points.push({
      x: x / CANVAS_SIZE,
      y: y / CANVAS_SIZE,
      pressure
    });
    this.bounds = null; // Инвалидируем bounds
  }

  /**
   * Получение точек в абсолютных координатах для заданного размера
   */
  getPointsAtSize(size) {
    return this.points.map(p => ({
      x: p.x * size,
      y: p.y * size,
      pressure: p.pressure
    }));
  }

  /**
   * Получение размера кисти для заданного масштаба canvas
   */
  getSizeAtScale(canvasSize) {
    return this.size * (canvasSize / CANVAS_SIZE);
  }

  /**
   * Вычисление границ штриха
   */
  getBounds() {
    if (this.bounds) return this.bounds;
    if (this.points.length === 0) return null;

    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const p of this.points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }

    // Учитываем размер кисти
    const padding = (this.size / CANVAS_SIZE) * 1.5;
    this.bounds = {
      minX: Math.max(0, minX - padding),
      minY: Math.max(0, minY - padding),
      maxX: Math.min(1, maxX + padding),
      maxY: Math.min(1, maxY + padding)
    };

    return this.bounds;
  }

  /**
   * Проверка пересечения с областью (для оптимизации рендеринга)
   */
  intersects(viewBounds) {
    const b = this.getBounds();
    if (!b) return false;
    
    return !(b.maxX < viewBounds.minX || 
             b.minX > viewBounds.maxX || 
             b.maxY < viewBounds.minY || 
             b.minY > viewBounds.maxY);
  }

  /**
   * Сериализация для сохранения
   */
  serialize() {
    return {
      id: this.id,
      tool: this.tool,
      color: this.color,
      size: this.size,
      hardness: this.hardness,
      opacity: this.opacity,
      points: this.points
    };
  }

  /**
   * Десериализация
   */
  static deserialize(data) {
    const stroke = new VectorStroke({
      tool: data.tool,
      color: data.color,
      size: data.size,
      hardness: data.hardness,
      opacity: data.opacity
    });
    stroke.id = data.id;
    stroke.points = data.points;
    return stroke;
  }
}

/**
 * Менеджер векторных штрихов для слоя
 */
export class VectorStrokeManager {
  constructor() {
    this.strokes = [];
    this.currentStroke = null;
    this.renderCache = new Map(); // Кэш растровых рендеров
    this.maxCacheSize = 5;
  }

  /**
   * Начало нового штриха
   */
  beginStroke(options) {
    this.currentStroke = new VectorStroke(options);
    return this.currentStroke;
  }

  /**
   * Добавление точки к текущему штриху
   */
  addPoint(x, y, pressure = 1) {
    if (!this.currentStroke) return;
    this.currentStroke.addPoint(x, y, pressure);
    this.invalidateCache();
  }

  /**
   * Завершение штриха
   */
  endStroke() {
    if (this.currentStroke && this.currentStroke.points.length > 0) {
      this.strokes.push(this.currentStroke);
    }
    const stroke = this.currentStroke;
    this.currentStroke = null;
    this.invalidateCache();
    return stroke;
  }

  /**
   * Отмена текущего штриха
   */
  cancelStroke() {
    this.currentStroke = null;
  }

  /**
   * Удаление последнего штриха (для undo)
   */
  removeLastStroke() {
    if (this.strokes.length > 0) {
      this.strokes.pop();
      this.invalidateCache();
    }
  }

  /**
   * Очистка всех штрихов
   */
  clear() {
    this.strokes = [];
    this.currentStroke = null;
    this.invalidateCache();
  }

  /**
   * Инвалидация кэша
   */
  invalidateCache() {
    this.renderCache.clear();
  }

  /**
   * Получение кэшированного рендера или создание нового
   */
  getCachedRender(size, key = 'default') {
    const cacheKey = `${key}-${size}`;
    return this.renderCache.get(cacheKey);
  }

  /**
   * Сохранение рендера в кэш
   */
  setCachedRender(size, canvas, key = 'default') {
    const cacheKey = `${key}-${size}`;
    
    // Ограничиваем размер кэша
    if (this.renderCache.size >= this.maxCacheSize) {
      const firstKey = this.renderCache.keys().next().value;
      this.renderCache.delete(firstKey);
    }
    
    this.renderCache.set(cacheKey, canvas);
  }

  /**
   * Получение штрихов, пересекающих область
   */
  getStrokesInBounds(viewBounds) {
    return this.strokes.filter(s => s.intersects(viewBounds));
  }

  /**
   * Сериализация всех штрихов
   */
  serialize() {
    return {
      strokes: this.strokes.map(s => s.serialize())
    };
  }

  /**
   * Десериализация
   */
  static deserialize(data) {
    const manager = new VectorStrokeManager();
    if (data.strokes) {
      manager.strokes = data.strokes.map(s => VectorStroke.deserialize(s));
    }
    return manager;
  }
}

export default VectorStrokeManager;