import { useState, useCallback, useRef, useEffect } from 'react';
import { CANVAS_SIZE, TOOLS, PERFORMANCE } from '../utils/constants';
import { drawLine, drawPoint, getDistance, initUVMaskCache, applyUVMask } from '../utils/drawingUtils';
import { LAYER_TYPES } from './useLayers';

/**
 * Хук для рисования на слоях с поддержкой hardness
 */
export function useDrawingWithLayers(uvLayoutImage, getActiveLayer, addDrawingLayer, saveToHistory, onCanvasUpdate) {
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  const lastDrawPointRef = useRef(null);
  const currentDrawingLayerRef = useRef(null);
  const initializedRef = useRef(false);
  const needNewLayerRef = useRef(false);
  
  const onCanvasUpdateRef = useRef(onCanvasUpdate);
  useEffect(() => {
    onCanvasUpdateRef.current = onCanvasUpdate;
  }, [onCanvasUpdate]);

  useEffect(() => {
    if (uvLayoutImage && !initializedRef.current) {
      initializedRef.current = true;
      initUVMaskCache(uvLayoutImage);
    }
  }, [uvLayoutImage]);

  const startDrawing = useCallback((tool) => {
    const activeLayer = getActiveLayer();
    
    if (tool === TOOLS.ERASE) {
      if (!activeLayer) {
        needNewLayerRef.current = true;
      } else {
        needNewLayerRef.current = false;
        currentDrawingLayerRef.current = activeLayer;
      }
    } else {
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

  // Добавлен параметр hardness
  const drawOnCanvas = useCallback((x, y, tool, brushColor, brushSize, forceNew = false, hardness = 80) => {
    if (!isDrawingRef.current) return;
    
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
        
        drawLine(lastPoint.x, lastPoint.y, x, y, tool, brushColor, brushSize, ctx, hardness);
      } else {
        drawPoint(x, y, tool, brushColor, brushSize, ctx, hardness);
      }
      
      lastDrawPointRef.current = { x, y };
    }
    
    if (tool === TOOLS.DRAW && uvLayoutImage && layer.canvas) {
      applyUVMask(layer.canvas, uvLayoutImage);
    }
    
    if (onCanvasUpdateRef.current) {
      onCanvasUpdateRef.current();
    }
  }, [uvLayoutImage, addDrawingLayer]);

  const stopDrawing = useCallback(() => {
    if (isDrawingRef.current) {
      if (saveToHistory) {
        saveToHistory();
      }
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