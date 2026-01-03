/**
 * Менеджер инструментов
 * Управляет регистрацией и переключением инструментов
 */

import { BrushTool } from './BrushTool';
import { EraserTool } from './EraserTool';
import { StampTool } from './StampTool';
import { TOOLS } from '../utils/constants';

class ToolManager {
  constructor() {
    this.tools = new Map();
    this.currentTool = null;
    this.currentToolId = null;
    
    // Регистрация стандартных инструментов
    this.register(TOOLS.DRAW, new BrushTool());
    this.register(TOOLS.ERASE, new EraserTool());
    this.register(TOOLS.STAMP, new StampTool());
  }

  /**
   * Регистрация нового инструмента
   * @param {string} id - уникальный идентификатор
   * @param {BaseTool} tool - экземпляр инструмента
   */
  register(id, tool) {
    this.tools.set(id, tool);
  }

  /**
   * Получение инструмента по ID
   * @param {string} id 
   * @returns {BaseTool|null}
   */
  get(id) {
    return this.tools.get(id) || null;
  }

  /**
   * Выбор текущего инструмента
   * @param {string} id 
   * @param {Object} context - контекст для onSelect
   */
  select(id, context = {}) {
    const tool = this.tools.get(id);
    if (!tool) {
      console.warn(`Tool not found: ${id}`);
      return false;
    }
    
    // Деактивируем предыдущий инструмент
    if (this.currentTool) {
      this.currentTool.onDeselect(context);
    }
    
    this.currentTool = tool;
    this.currentToolId = id;
    this.currentTool.onSelect(context);
    
    return true;
  }

  /**
   * Получение текущего инструмента
   * @returns {BaseTool|null}
   */
  getCurrent() {
    return this.currentTool;
  }

  /**
   * Получение ID текущего инструмента
   * @returns {string|null}
   */
  getCurrentId() {
    return this.currentToolId;
  }

  /**
   * Список всех зарегистрированных инструментов
   * @returns {Array<{id: string, tool: BaseTool}>}
   */
  list() {
    return Array.from(this.tools.entries()).map(([id, tool]) => ({
      id,
      tool,
      name: tool.name,
      cursor: tool.cursor
    }));
  }

  /**
   * Обработка нажатия
   */
  handlePointerDown(point, context) {
    if (!this.currentTool) return null;
    return this.currentTool.onPointerDown(point, context);
  }

  /**
   * Обработка движения
   */
  handlePointerMove(point, context) {
    if (!this.currentTool) return null;
    return this.currentTool.onPointerMove(point, context);
  }

  /**
   * Обработка отпускания
   */
  handlePointerUp(point, context) {
    if (!this.currentTool) return null;
    return this.currentTool.onPointerUp(point, context);
  }

  /**
   * Отмена текущего действия
   */
  handleCancel(context) {
    if (this.currentTool) {
      this.currentTool.onCancel(context);
    }
  }

  /**
   * Рендер превью инструмента
   */
  renderPreview(ctx, point, settings, context) {
    if (this.currentTool && this.currentTool.renderPreview) {
      this.currentTool.renderPreview(ctx, point, settings, context);
    }
  }
}

// Синглтон менеджера
export const toolManager = new ToolManager();

export default toolManager;
