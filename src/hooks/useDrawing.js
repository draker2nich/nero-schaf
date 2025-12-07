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
  
  // Состояние нажатия - это ключевое для предотвращения рисования без клика
  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);
  
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const initializedRef = useRef(false);

  // Инициализация drawing layer
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

  // Инициализация UV маски и начального состояния истории
  useEffect(() => {
    if (uvLayoutImage && !initializedRef.current) {
      initializedRef.current = true;
      initUVMaskCache(uvLayoutImage);
      
      const emptyCanvas = document.createElement('canvas');
      emptyCanvas.width = CANVAS_SIZE;
      emptyCanvas.height = CANVAS_SIZE;
      
      setHistory([emptyCanvas.toDataURL('image/png', 0.8)]);
      setHistoryIndex(0);
    }
  }, [uvLayoutImage]);

  // Рисование на canvas - ТОЛЬКО если isDrawing === true
  const drawOnCanvas = useCallback((x, y, tool, brushColor, brushSize, forceNew = false) => {
    // Проверяем флаг нажатия
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

  // Сохранение в историю
  const saveToHistory = useCallback(() => {
    if (!drawingLayerRef.current) return;
    
    const dataUrl = drawingLayerRef.current.toDataURL('image/png', 0.8);
    
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(dataUrl);
      
      if (newHistory.length > MAX_HISTORY) {
        return newHistory.slice(-MAX_HISTORY);
      }
      return newHistory;
    });
    
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  // Восстановление из истории
  const restoreFromHistory = useCallback((index) => {
    if (index < 0 || index >= history.length) return;
    
    const img = new Image();
    img.onload = () => {
      const ctx = ensureDrawingLayer();
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(img, 0, 0);
      onCanvasUpdate();
    };
    img.src = history[index];
  }, [history, onCanvasUpdate, ensureDrawingLayer]);

  // Начало рисования - устанавливаем флаг
  const startDrawing = useCallback(() => {
    setIsDrawing(true);
    isDrawingRef.current = true;
    lastDrawPointRef.current = null;
  }, []);

  // Окончание рисования - сбрасываем флаг и сохраняем
  const stopDrawing = useCallback(() => {
    if (isDrawingRef.current) {
      saveToHistory();
    }
    setIsDrawing(false);
    isDrawingRef.current = false;
    lastDrawPointRef.current = null;
  }, [saveToHistory]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    restoreFromHistory(newIndex);
  }, [historyIndex, restoreFromHistory]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    restoreFromHistory(newIndex);
  }, [historyIndex, history.length, restoreFromHistory]);

  const clearCanvas = useCallback(() => {
    if (drawingLayerRef.current) {
      const ctx = drawingCtxRef.current || drawingLayerRef.current.getContext('2d');
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = CANVAS_SIZE;
    emptyCanvas.height = CANVAS_SIZE;
    
    setHistory([emptyCanvas.toDataURL('image/png', 0.8)]);
    setHistoryIndex(0);
    
    onCanvasUpdate();
  }, [onCanvasUpdate]);

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
    history,
    historyIndex,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1
  };
}