import { useState, useCallback, useRef, useEffect } from 'react';
import { CANVAS_SIZE, TOOLS, MAX_HISTORY, PERFORMANCE } from '../utils/constants';
import { 
  drawLine, 
  drawPoint, 
  getDistance, 
  initUVMaskCache,
  applyUVMask 
} from '../utils/drawingUtils';

export function useDrawing(uvLayoutImage, onCanvasUpdate) {
  const drawingLayerRef = useRef(null);
  const drawingCtxRef = useRef(null);
  const lastDrawPointRef = useRef(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  
  // Refs для истории
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  
  // Состояния для UI
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  
  const initializedRef = useRef(false);
  const isRestoringRef = useRef(false);

  const updateHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1
    });
  }, []);

  const ensureDrawingLayer = useCallback(() => {
    if (!drawingLayerRef.current) {
      drawingLayerRef.current = document.createElement('canvas');
      drawingLayerRef.current.width = CANVAS_SIZE;
      drawingLayerRef.current.height = CANVAS_SIZE;
    }
    if (!drawingCtxRef.current) {
      drawingCtxRef.current = drawingLayerRef.current.getContext('2d', {
        willReadFrequently: false
      });
    }
    return drawingCtxRef.current;
  }, []);

  useEffect(() => {
    if (uvLayoutImage && !initializedRef.current) {
      initializedRef.current = true;
      initUVMaskCache(uvLayoutImage);
      
      const emptyCanvas = document.createElement('canvas');
      emptyCanvas.width = CANVAS_SIZE;
      emptyCanvas.height = CANVAS_SIZE;
      
      const initialState = emptyCanvas.toDataURL('image/png', 0.8);
      historyRef.current = [initialState];
      historyIndexRef.current = 0;
      updateHistoryState();
    }
  }, [uvLayoutImage, updateHistoryState]);

  const drawOnCanvas = useCallback((x, y, tool, brushColor, brushSize, forceNew = false) => {
    if (!isDrawingRef.current) return;
    
    const ctx = ensureDrawingLayer();
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
    
    if (tool === TOOLS.DRAW && uvLayoutImage) {
      applyUVMask(drawingLayerRef.current, uvLayoutImage);
    }
    
    onCanvasUpdate();
  }, [uvLayoutImage, onCanvasUpdate, ensureDrawingLayer]);

  const saveToHistory = useCallback(() => {
    if (!drawingLayerRef.current) return;
    
    const dataUrl = drawingLayerRef.current.toDataURL('image/png', 0.8);
    
    const currentIndex = historyIndexRef.current;
    const newHistory = historyRef.current.slice(0, currentIndex + 1);
    newHistory.push(dataUrl);
    
    if (newHistory.length > MAX_HISTORY) {
      const overflow = newHistory.length - MAX_HISTORY;
      historyRef.current = newHistory.slice(overflow);
      historyIndexRef.current = historyRef.current.length - 1;
    } else {
      historyRef.current = newHistory;
      historyIndexRef.current = newHistory.length - 1;
    }
    
    updateHistoryState();
  }, [updateHistoryState]);

  // ИСПРАВЛЕНО: Восстановление с гарантированной синхронизацией 3D модели
  const restoreFromHistory = useCallback((index) => {
    if (index < 0 || index >= historyRef.current.length) return;
    if (isRestoringRef.current) return;
    
    isRestoringRef.current = true;
    
    const img = new Image();
    
    img.onload = () => {
      const ctx = ensureDrawingLayer();
      
      // 1. Очищаем canvas
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      
      // 2. Рисуем восстановленное состояние
      ctx.drawImage(img, 0, 0);
      
      // 3. Принудительно обновляем UV canvas и 3D текстуру
      // force = true гарантирует немедленное обновление без throttling
      onCanvasUpdate(true);
      
      // 4. Дополнительный вызов через RAF для гарантии
      // что Three.js получит обновлённую текстуру
      requestAnimationFrame(() => {
        onCanvasUpdate(true);
        isRestoringRef.current = false;
      });
    };
    
    img.onerror = () => {
      console.error('Ошибка загрузки состояния истории');
      isRestoringRef.current = false;
    };
    
    img.src = historyRef.current[index];
  }, [onCanvasUpdate, ensureDrawingLayer]);

  const startDrawing = useCallback(() => {
    if (isRestoringRef.current) return;
    setIsDrawing(true);
    isDrawingRef.current = true;
    lastDrawPointRef.current = null;
  }, []);

  const stopDrawing = useCallback(() => {
    if (isDrawingRef.current) {
      saveToHistory();
    }
    setIsDrawing(false);
    isDrawingRef.current = false;
    lastDrawPointRef.current = null;
  }, [saveToHistory]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    if (isRestoringRef.current) return;
    
    const newIndex = historyIndexRef.current - 1;
    historyIndexRef.current = newIndex;
    updateHistoryState();
    restoreFromHistory(newIndex);
  }, [restoreFromHistory, updateHistoryState]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    if (isRestoringRef.current) return;
    
    const newIndex = historyIndexRef.current + 1;
    historyIndexRef.current = newIndex;
    updateHistoryState();
    restoreFromHistory(newIndex);
  }, [restoreFromHistory, updateHistoryState]);

  const clearCanvas = useCallback((onCleared) => {
    if (isRestoringRef.current) return;
    
    if (drawingLayerRef.current) {
      const ctx = drawingCtxRef.current || drawingLayerRef.current.getContext('2d');
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = CANVAS_SIZE;
    emptyCanvas.height = CANVAS_SIZE;
    
    const emptyState = emptyCanvas.toDataURL('image/png', 0.8);
    historyRef.current = [emptyState];
    historyIndexRef.current = 0;
    updateHistoryState();
    
    if (typeof onCleared === 'function') {
      onCleared();
    }
    
    // Принудительное обновление с гарантией синхронизации
    onCanvasUpdate(true);
    requestAnimationFrame(() => onCanvasUpdate(true));
  }, [onCanvasUpdate, updateHistoryState]);

  return {
    drawingLayerRef,
    isDrawing,
    startDrawing,
    stopDrawing,
    drawOnCanvas,
    saveToHistory,
    undo,
    redo,
    clearCanvas,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo
  };
}