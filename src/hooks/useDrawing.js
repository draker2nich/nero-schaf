/**
 * Хук для рисования с поддержкой векторных данных и штампа
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { CANVAS_SIZE, TOOLS, PERFORMANCE } from '../utils/constants';
import { toolManager } from '../tools/ToolManager';
import { initUVMaskCache, applyUVMask } from '../utils/drawingUtils';
import { LAYER_TYPES } from './useLayers';

// Глобальный кэш UV-маски
let uvMaskDataCache = null;

export function getUVMaskCache() {
  return uvMaskDataCache;
}

export function useDrawingWithTools(
  uvLayoutImage, 
  getActiveLayer, 
  addDrawingLayer, 
  saveToHistory, 
  onCanvasUpdate,
  viewport,
  screenToCanvas,
  getCompositeCanvas,
  getLayers
) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState(TOOLS.DRAW);
  const [stampSourceSet, setStampSourceSet] = useState(false);
  
  const isDrawingRef = useRef(false);
  const currentDrawingLayerRef = useRef(null);
  const needNewLayerRef = useRef(false);
  const initializedRef = useRef(false);
  const layersRef = useRef(null);
  
  // Для текущего штриха
  const currentStrokeRef = useRef(null);
  
  const onCanvasUpdateRef = useRef(onCanvasUpdate);
  const getLayersRef = useRef(getLayers);
  const getCompositeCanvasRef = useRef(getCompositeCanvas);
  
  useEffect(() => { onCanvasUpdateRef.current = onCanvasUpdate; }, [onCanvasUpdate]);
  useEffect(() => { getLayersRef.current = getLayers; }, [getLayers]);
  useEffect(() => { getCompositeCanvasRef.current = getCompositeCanvas; }, [getCompositeCanvas]);

  // Инициализация UV маски
  useEffect(() => {
    if (uvLayoutImage && !initializedRef.current) {
      initializedRef.current = true;
      initUVMaskCache(uvLayoutImage);
      
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      uvMaskDataCache = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
    }
  }, [uvLayoutImage]);

  const updateLayersRef = useCallback((layers) => {
    layersRef.current = layers;
  }, []);

  const selectTool = useCallback((toolId) => {
    toolManager.select(toolId, {});
    setCurrentTool(toolId);
    
    if (toolId === TOOLS.STAMP) {
      const stampTool = toolManager.get(TOOLS.STAMP);
      setStampSourceSet(stampTool?.hasSource() || false);
    }
  }, []);

  const setStampSource = useCallback((x, y, compositeCanvas) => {
    const stampTool = toolManager.get(TOOLS.STAMP);
    if (stampTool) {
      const layers = getLayersRef.current ? getLayersRef.current() : layersRef.current;
      const composite = compositeCanvas || (getCompositeCanvasRef.current ? getCompositeCanvasRef.current() : null);
      
      const result = stampTool.setSource({ x, y }, { 
        compositeCanvas: composite,
        layers,
        uvMaskData: uvMaskDataCache
      });
      setStampSourceSet(result);
      return result;
    }
    return false;
  }, []);

  const getPressure = useCallback((e) => {
    if (e.pressure !== undefined && e.pressure > 0) return e.pressure;
    if (e.touches?.[0]?.force) return e.touches[0].force;
    return 1.0;
  }, []);

  const isTouch = useCallback((e) => {
    return e.touches !== undefined || e.pointerType === 'touch';
  }, []);

  const eventToPoint = useCallback((e, canvasRect) => {
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    
    const screenX = clientX - canvasRect.left;
    const screenY = clientY - canvasRect.top;
    
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

  const getStampContext = useCallback((e, compositeCanvas) => {
    const layers = getLayersRef.current ? getLayersRef.current() : layersRef.current;
    const composite = compositeCanvas || (getCompositeCanvasRef.current ? getCompositeCanvasRef.current() : null);
    
    return {
      compositeCanvas: composite,
      layers,
      uvMaskData: uvMaskDataCache,
      altKey: e?.altKey || false,
      isMobile: 'ontouchstart' in window,
      isTouch: e ? isTouch(e) : false,
      onSourceSet: (point) => {
        setStampSourceSet(true);
        if (onCanvasUpdateRef.current) onCanvasUpdateRef.current(true);
      }
    };
  }, [isTouch]);

  /**
   * Начало рисования - создаёт векторный штрих
   */
  const startDrawing = useCallback((e, canvasRect, settings, compositeCanvas) => {
    const point = eventToPoint(e, canvasRect);
    const activeLayer = getActiveLayer();
    const tool = toolManager.getCurrent();
    const toolId = toolManager.getCurrentId();
    
    const stampContext = getStampContext(e, compositeCanvas);
    
    // Alt+Click для штампа
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
    
    // Создаём векторный штрих для кисти и ластика
    if ((toolId === TOOLS.DRAW || toolId === TOOLS.ERASE) && layer.vectorStrokes) {
      currentStrokeRef.current = layer.vectorStrokes.beginStroke({
        tool: toolId,
        color: settings.brushColor || settings.color,
        size: settings.brushSize || settings.size,
        hardness: settings.brushHardness ?? settings.hardness ?? 80,
        opacity: settings.brushOpacity ?? settings.opacity ?? 100
      });
      
      // Добавляем первую точку
      layer.vectorStrokes.addPoint(point.x, point.y, point.pressure);
    }
    
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
      ...stampContext
    };
    
    const result = tool?.onPointerDown(point, context);
    
    if (result?.sourceSet) {
      setStampSourceSet(true);
      if (onCanvasUpdateRef.current) onCanvasUpdateRef.current(true);
      return;
    }
    
    if (result?.needSource) return;
    
    setIsDrawing(true);
    isDrawingRef.current = true;
    
    // Применяем UV маску
    if ((toolId === TOOLS.DRAW || toolId === TOOLS.STAMP) && uvLayoutImage && layer.canvas) {
      applyUVMask(layer.canvas, uvLayoutImage);
    }
    
    if (onCanvasUpdateRef.current) onCanvasUpdateRef.current();
  }, [eventToPoint, getActiveLayer, addDrawingLayer, uvLayoutImage, setStampSource, getStampContext]);

  /**
   * Продолжение рисования - добавляет точки в векторный штрих
   */
  const continueDrawing = useCallback((e, canvasRect, settings, compositeCanvas) => {
    if (!isDrawingRef.current) return;
    
    const point = eventToPoint(e, canvasRect);
    const layer = currentDrawingLayerRef.current;
    const tool = toolManager.getCurrent();
    const toolId = toolManager.getCurrentId();
    
    if (!layer || !layer.ctx || !tool) return;
    
    // Добавляем точку в векторный штрих
    if ((toolId === TOOLS.DRAW || toolId === TOOLS.ERASE) && layer.vectorStrokes && currentStrokeRef.current) {
      layer.vectorStrokes.addPoint(point.x, point.y, point.pressure);
    }
    
    const stampContext = getStampContext(e, compositeCanvas);
    
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
      ...stampContext
    };
    
    tool.onPointerMove(point, context);
    
    if ((toolId === TOOLS.DRAW || toolId === TOOLS.STAMP) && uvLayoutImage && layer.canvas) {
      applyUVMask(layer.canvas, uvLayoutImage);
    }
    
    if (onCanvasUpdateRef.current) onCanvasUpdateRef.current();
  }, [eventToPoint, uvLayoutImage, getStampContext]);

  /**
   * Окончание рисования - завершает векторный штрих
   */
  const stopDrawing = useCallback((e, canvasRect) => {
    const tool = toolManager.getCurrent();
    const layer = currentDrawingLayerRef.current;
    const toolId = toolManager.getCurrentId();
    
    if (tool) {
      const point = e && canvasRect ? eventToPoint(e, canvasRect) : { x: 0, y: 0 };
      tool.onPointerUp(point, {
        layer,
        canvas: layer?.canvas,
        ctx: layer?.ctx
      });
    }
    
    // Завершаем векторный штрих
    if ((toolId === TOOLS.DRAW || toolId === TOOLS.ERASE) && layer?.vectorStrokes) {
      layer.vectorStrokes.endStroke();
      currentStrokeRef.current = null;
    }
    
    // Инвалидируем кэш штампа после рисования
    const stampTool = toolManager.get(TOOLS.STAMP);
    if (stampTool) stampTool.invalidateCache();
    
    if (isDrawingRef.current && saveToHistory) saveToHistory();
    
    if (onCanvasUpdateRef.current) onCanvasUpdateRef.current(true);
    
    setIsDrawing(false);
    isDrawingRef.current = false;
    currentDrawingLayerRef.current = null;
    needNewLayerRef.current = false;
  }, [eventToPoint, saveToHistory]);

  const cancelDrawing = useCallback(() => {
    const layer = currentDrawingLayerRef.current;
    
    // Отменяем векторный штрих
    if (layer?.vectorStrokes) {
      layer.vectorStrokes.cancelStroke();
      currentStrokeRef.current = null;
    }
    
    toolManager.handleCancel({});
    setIsDrawing(false);
    isDrawingRef.current = false;
    currentDrawingLayerRef.current = null;
    needNewLayerRef.current = false;
  }, []);

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

  const needsStampSource = useCallback(() => {
    if (currentTool !== TOOLS.STAMP) return false;
    const stampTool = toolManager.get(TOOLS.STAMP);
    return stampTool && !stampTool.hasSource();
  }, [currentTool]);

  const getStampSourcePoint = useCallback(() => {
    const stampTool = toolManager.get(TOOLS.STAMP);
    return stampTool?.getSourcePoint() || null;
  }, []);

  return {
    isDrawing,
    currentTool,
    stampSourceSet,
    selectTool,
    setStampSource,
    needsStampSource,
    getStampSourcePoint,
    updateLayersRef,
    startDrawing,
    continueDrawing,
    stopDrawing,
    cancelDrawing,
    renderToolPreview,
    eventToPoint
  };
}

export default useDrawingWithTools;