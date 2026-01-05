/**
 * Менеджер инструментов
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

  register(id, tool) {
    this.tools.set(id, tool);
  }

  get(id) {
    return this.tools.get(id) || null;
  }

  select(id, context = {}) {
    const tool = this.tools.get(id);
    if (!tool) {
      console.warn(`Tool not found: ${id}`);
      return false;
    }
    
    if (this.currentTool) {
      this.currentTool.onDeselect(context);
    }
    
    this.currentTool = tool;
    this.currentToolId = id;
    this.currentTool.onSelect(context);
    
    return true;
  }

  getCurrent() {
    return this.currentTool;
  }

  getCurrentId() {
    return this.currentToolId;
  }

  list() {
    return Array.from(this.tools.entries()).map(([id, tool]) => ({
      id,
      tool,
      name: tool.name,
      cursor: tool.cursor
    }));
  }

  handlePointerDown(point, context) {
    if (!this.currentTool) return null;
    return this.currentTool.onPointerDown(point, context);
  }

  handlePointerMove(point, context) {
    if (!this.currentTool) return null;
    return this.currentTool.onPointerMove(point, context);
  }

  handlePointerUp(point, context) {
    if (!this.currentTool) return null;
    return this.currentTool.onPointerUp(point, context);
  }

  handleCancel(context) {
    if (this.currentTool) {
      this.currentTool.onCancel(context);
    }
  }

  renderPreview(ctx, point, settings, context) {
    if (this.currentTool && this.currentTool.renderPreview) {
      this.currentTool.renderPreview(ctx, point, settings, context);
    }
  }
}

export const toolManager = new ToolManager();

export default toolManager;