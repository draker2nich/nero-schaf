/**
 * Хук для рисования с новой архитектурой инструментов
 * 
 * Поддерживает:
 * - Все инструменты через ToolManager
 * - Давление планшета (Pointer Events)
 * - Прозрачность кисти
 * - Интеграцию с viewport (зум/пан)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { CANVAS_SIZE, TOOLS, PERFORMANCE } from '../utils/constants';
import { toolManager } from '../tools/ToolManager';
import { initUVMaskCache, applyUVMask } from '../utils/drawingUtils';
import { LAYER_TYPES } from './useLayers';

export function useDrawingWithTools(
  uvLayoutImage, 
  getActiveLayer, 
  addDrawingLayer, 
  saveToHistory, 
  onCanvasUpdate,
  viewport,
  screenToCanvas,
  getAllLayersComposite
) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState(TOOLS.DRAW);
  const [stampSourceSet, setStampSourceSet] = useState(false);
  
  const isDrawingRef = useRef(false);
  const currentDrawingLayerRef = useRef(null);
  const needNewLayerRef = useRef(false);
  const initializedRef = useRef(false);
  
  const onCanvasUpdateRef = useRef(onCanvasUpdate);
  useEffect(() => { onCanvasUpdateRef.current = onCanvasUpdate; }, [onCanvasUpdate]);

  // Инициализация UV маски
  useEffect(() => {
    if (uvLayoutImage && !initializedRef.current) {
      initializedRef.current = true;
      initUVMaskCache(uvLayoutImage);
    }
  }, [uvLayoutImage]);

  /**
   * Выбор инструмента
   */
  const selectTool = useCallback((toolId) => {
    toolManager.select(toolId, {});
    setCurrentTool(toolId);
    
    // Обновляем статус штампа
    if (toolId === TOOLS.STAMP) {
      const stampTool = toolManager.get(TOOLS.STAMP);
      setStampSourceSet(stampTool?.hasSource() || false);
    }
  }, []);

  /**
   * Установка источника штампа
   */
  const setStampSource = useCallback((x, y, compositeCanvas) => {
    const stampTool = toolManager.get(TOOLS.STAMP);
    if (stampTool) {
      stampTool.setSource({ x, y }, { compositeCanvas });
      setStampSourceSet(true);
      return true;
    }
    return false;
  }, []);

  /**
   * Извлечение давления из события
   */
  const getPressure = useCallback((e) => {
    // Pointer Events API для давления
    if (e.pressure !== undefined && e.pressure > 0) {
      return e.pressure;
    }
    // Touch Events fallback
    if (e.touches?.[0]?.force) {
      return e.touches[0].force;
    }
    // Нет давления - возвращаем 1
    return 1.0;
  }, []);

  /**
   * Преобразование события в точку с учётом viewport
   */
  const eventToPoint = useCallback((e, canvasRect) => {
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    
    // Координаты относительно контейнера canvas
    const screenX = clientX - canvasRect.left;
    const screenY = clientY - canvasRect.top;
    
    // Преобразуем в координаты холста с учётом зума
    const canvasCoords = screenToCanvas 
      ? screenToCanvas(screenX, screenY)
      : { 
          x: screenX * (CANVAS_SIZE / canvasRect.width),
          y: screenY * (CANVAS_SIZE / canvasRect.height)
        };
    
    return {
      x: canvasCoords.x,
      y: canvasCoords.y,
      pressure: getPressure(e),
      screenX,
      screenY
    };
  }, [screenToCanvas, getPressure]);

  /**
   * Начало рисования
   */
  const startDrawing = useCallback((e, canvasRect, settings, compositeCanvas) => {
    const point = eventToPoint(e, canvasRect);
    const activeLayer = getActiveLayer();
    const tool = toolManager.getCurrent();
    const toolId = toolManager.getCurrentId();
    
    // Проверка Alt+Click для штампа
    if (toolId === TOOLS.STAMP && e.altKey) {
      setStampSource(point.x, point.y, compositeCanvas);
      return;
    }
    
    // Определяем нужен ли новый слой
    if (toolId === TOOLS.ERASE) {
      if (!activeLayer) {
        needNewLayerRef.current = true;
      } else {
        needNewLayerRef.current = false;
        currentDrawingLayerRef.current = activeLayer;
      }
    } else if (toolId === TOOLS.DRAW || toolId === TOOLS.STAMP) {
      if (!activeLayer || activeLayer.type !== LAYER_TYPES.DRAWING) {
        needNewLayerRef.current = true;
      } else {
        needNewLayerRef.current = false;
        currentDrawingLayerRef.current = activeLayer;
      }
    }
    
    // Создаём новый слой если нужно
    if (needNewLayerRef.current && toolId !== TOOLS.ERASE) {
      const newLayer = addDrawingLayer();
      currentDrawingLayerRef.current = newLayer;
      needNewLayerRef.current = false;
    }
    
    const layer = currentDrawingLayerRef.current;
    if (!layer || !layer.ctx) return;
    
    // Контекст для инструмента
    const context = {
      layer,
      canvas: layer.canvas,
      ctx: layer.ctx,
      settings: {
        ...settings,
        size: settings.brushSize || settings.size,
        color: settings.brushColor || settings.color,
        hardness: settings.brushHardness ?? settings.hardness ?? 80,
        opacity: settings.brushOpacity ?? settings.opacity ?? 100
      },
      compositeCanvas
    };
    
    // Вызов обработчика инструмента
    const result = tool?.onPointerDown(point, context);
    
    // Проверка на необходимость установки источника штампа
    if (result?.needSource) {
      console.log('Stamp: Alt+Click to set source first');
      return;
    }
    
    setIsDrawing(true);
    isDrawingRef.current = true;
    
    // Применяем UV маску и обновляем canvas
    if (toolId === TOOLS.DRAW && uvLayoutImage && layer.canvas) {
      applyUVMask(layer.canvas, uvLayoutImage);
    }
    
    if (onCanvasUpdateRef.current) {
      onCanvasUpdateRef.current();
    }
  }, [eventToPoint, getActiveLayer, addDrawingLayer, uvLayoutImage, setStampSource]);

  /**
   * Продолжение рисования
   */
  const continueDrawing = useCallback((e, canvasRect, settings, compositeCanvas) => {
    if (!isDrawingRef.current) return;
    
    const point = eventToPoint(e, canvasRect);
    const layer = currentDrawingLayerRef.current;
    const tool = toolManager.getCurrent();
    const toolId = toolManager.getCurrentId();
    
    if (!layer || !layer.ctx || !tool) return;
    
    const context = {
      layer,
      canvas: layer.canvas,
      ctx: layer.ctx,
      settings: {
        ...settings,
        size: settings.brushSize || settings.size,
        color: settings.brushColor || settings.color,
        hardness: settings.brushHardness ?? settings.hardness ?? 80,
        opacity: settings.brushOpacity ?? settings.opacity ?? 100
      },
      compositeCanvas
    };
    
    tool.onPointerMove(point, context);
    
    // Применяем UV маску
    if (toolId === TOOLS.DRAW && uvLayoutImage && layer.canvas) {
      applyUVMask(layer.canvas, uvLayoutImage);
    }
    
    if (onCanvasUpdateRef.current) {
      onCanvasUpdateRef.current();
    }
  }, [eventToPoint, uvLayoutImage]);

  /**
   * Окончание рисования
   */
  const stopDrawing = useCallback((e, canvasRect) => {
    if (!isDrawingRef.current) return;
    
    const tool = toolManager.getCurrent();
    const layer = currentDrawingLayerRef.current;
    
    if (tool && layer) {
      const point = e ? eventToPoint(e, canvasRect) : { x: 0, y: 0 };
      tool.onPointerUp(point, {
        layer,
        canvas: layer.canvas,
        ctx: layer.ctx
      });
    }
    
    if (saveToHistory) {
      saveToHistory();
    }
    
    if (onCanvasUpdateRef.current) {
      onCanvasUpdateRef.current(true);
    }
    
    setIsDrawing(false);
    isDrawingRef.current = false;
    currentDrawingLayerRef.current = null;
    needNewLayerRef.current = false;
  }, [eventToPoint, saveToHistory]);

  /**
   * Отмена текущего действия
   */
  const cancelDrawing = useCallback(() => {
    toolManager.handleCancel({});
    setIsDrawing(false);
    isDrawingRef.current = false;
    currentDrawingLayerRef.current = null;
    needNewLayerRef.current = false;
  }, []);

  /**
   * Рендер превью инструмента
   */
  const renderToolPreview = useCallback((previewCtx, point, settings, compositeCanvas) => {
    const tool = toolManager.getCurrent();
    if (!tool) return;
    
    const fullSettings = {
      ...settings,
      size: settings.brushSize || settings.size,
      color: settings.brushColor || settings.color,
      hardness: settings.brushHardness ?? settings.hardness ?? 80,
      opacity: settings.brushOpacity ?? settings.opacity ?? 100
    };
    
    tool.renderPreview(previewCtx, point, fullSettings, { compositeCanvas });
  }, []);

  /**
   * Проверка: нужен ли источник для штампа
   */
  const needsStampSource = useCallback(() => {
    if (currentTool !== TOOLS.STAMP) return false;
    const stampTool = toolManager.get(TOOLS.STAMP);
    return stampTool && !stampTool.hasSource();
  }, [currentTool]);

  /**
   * Получение позиции источника штампа
   */
  const getStampSourcePoint = useCallback(() => {
    const stampTool = toolManager.get(TOOLS.STAMP);
    return stampTool?.getSourcePoint() || null;
  }, []);

  return {
    isDrawing,
    currentTool,
    stampSourceSet,
    
    // Управление инструментами
    selectTool,
    setStampSource,
    needsStampSource,
    getStampSourcePoint,
    
    // Обработчики рисования
    startDrawing,
    continueDrawing,
    stopDrawing,
    cancelDrawing,
    
    // Превью
    renderToolPreview,
    
    // Утилиты
    eventToPoint
  };
}

export default useDrawingWithTools;