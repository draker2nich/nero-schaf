import { useState, useCallback, useRef, useEffect } from 'react';

import { CANVAS_SIZE, TOOLS, PERFORMANCE } from '../utils/constants';
import { 
  drawLine, 
  drawPoint, 
  getDistance, 
  initUVMaskCache,
  applyUVMask 
} from '../utils/drawingUtils';
import { LAYER_TYPES } from './useLayers';

/**
 * Хук для рисования на слоях
 */
export function useDrawingWithLayers(uvLayoutImage, getActiveLayer, addDrawingLayer, saveToHistory, onCanvasUpdate) {
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const lastDrawPointRef = useRef(null);
  const currentDrawingLayerRef = useRef(null);
  const initializedRef = useRef(false);
  const needNewLayerRef = useRef(false);
  
  // Храним актуальный callback в ref
  const onCanvasUpdateRef = useRef(onCanvasUpdate);
  useEffect(() => {
    onCanvasUpdateRef.current = onCanvasUpdate;
  }, [onCanvasUpdate]);

  // Инициализация UV маски
  useEffect(() => {
    if (uvLayoutImage && !initializedRef.current) {
      initializedRef.current = true;
      initUVMaskCache(uvLayoutImage);
    }
  }, [uvLayoutImage]);

  // Начало рисования - определяем, на каком слое рисовать
  const startDrawing = useCallback((tool) => {
    const activeLayer = getActiveLayer();
    
    // Для ластика работаем на текущем слое (любого типа)
    if (tool === TOOLS.ERASE) {
      if (!activeLayer) {
        needNewLayerRef.current = true;
      } else {
        needNewLayerRef.current = false;
        currentDrawingLayerRef.current = activeLayer;
      }
    } else {
      // Для кисти создаём новый слой, если активный не подходит
      if (!activeLayer || activeLayer.type !== LAYER_TYPES.DRAWING) {
        needNewLayerRef.current = true;
      } else {
        needNewLayerRef.current = false;
        currentDrawingLayerRef.current = activeLayer;
      }
    }
    
    setIsDrawing(true);
    isDrawingRef.current = true;
    lastDrawPointRef.current = null;
  }, [getActiveLayer]);

  // Рисование на canvas
  const drawOnCanvas = useCallback((x, y, tool, brushColor, brushSize, forceNew = false) => {
    if (!isDrawingRef.current) return;
    
    // Создаём новый слой при первом касании, если нужно (только для кисти)
    if (needNewLayerRef.current && tool === TOOLS.DRAW) {
      const newLayer = addDrawingLayer();
      currentDrawingLayerRef.current = newLayer;
      needNewLayerRef.current = false;
    }
    
    const layer = currentDrawingLayerRef.current;
    if (!layer || !layer.ctx) return;
    
    const ctx = layer.ctx;
    const lastPoint = lastDrawPointRef.current;
    
    if (tool === TOOLS.DRAW || tool === TOOLS.ERASE) {
      if (lastPoint && !forceNew) {
        const dist = getDistance(lastPoint.x, lastPoint.y, x, y);
        if (dist < PERFORMANCE.MIN_DRAW_DISTANCE) return;
        
        drawLine(lastPoint.x, lastPoint.y, x, y, tool, brushColor, brushSize, ctx);
      } else {
        drawPoint(x, y, tool, brushColor, brushSize, ctx);
      }
      
      lastDrawPointRef.current = { x, y };
    }
    
    // Применяем UV маску только для рисования (не для стирания)
    if (tool === TOOLS.DRAW && uvLayoutImage && layer.canvas) {
      applyUVMask(layer.canvas, uvLayoutImage);
    }
    
    // Вызываем обновление canvas напрямую
    if (onCanvasUpdateRef.current) {
      onCanvasUpdateRef.current();
    }
  }, [uvLayoutImage, addDrawingLayer]);

  // Окончание рисования
  const stopDrawing = useCallback(() => {
    if (isDrawingRef.current) {
      if (saveToHistory) {
        saveToHistory();
      }
      // Финальное обновление после завершения рисования
      if (onCanvasUpdateRef.current) {
        onCanvasUpdateRef.current(true);
      }
    }
    setIsDrawing(false);
    isDrawingRef.current = false;
    lastDrawPointRef.current = null;
    currentDrawingLayerRef.current = null;
    needNewLayerRef.current = false;
  }, [saveToHistory]);

  return {
    isDrawing,
    startDrawing,
    stopDrawing,
    drawOnCanvas
  };
}