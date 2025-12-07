import { useState, useCallback, useRef } from 'react';
import { CANVAS_SIZE, TOOLS, MAX_HISTORY } from '../utils/constants';
import { drawLine, isPixelInUVMask } from '../utils/drawingUtils';

export function useDrawing(uvLayoutImage, initUVCanvas) {
  const drawingLayerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastDrawPoint, setLastDrawPoint] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const drawOnCanvas = useCallback((x, y, tool, brushColor, brushSize, fontSize, textInput, forceNew = false) => {
    if (!drawingLayerRef.current) {
      drawingLayerRef.current = document.createElement('canvas');
      drawingLayerRef.current.width = CANVAS_SIZE;
      drawingLayerRef.current.height = CANVAS_SIZE;
    }
    
    const drawingCtx = drawingLayerRef.current.getContext('2d');
    
    if (tool === TOOLS.DRAW || tool === TOOLS.ERASE) {
      if (lastDrawPoint && !forceNew) {
        drawLine(lastDrawPoint.x, lastDrawPoint.y, x, y, tool, brushColor, brushSize, uvLayoutImage, drawingCtx);
      } else {
        if (tool === TOOLS.DRAW) {
          if (isPixelInUVMask(uvLayoutImage, Math.round(x), Math.round(y))) {
            drawingCtx.fillStyle = brushColor;
            drawingCtx.beginPath();
            drawingCtx.arc(x, y, brushSize, 0, Math.PI * 2);
            drawingCtx.fill();
          }
        } else {
          drawingCtx.clearRect(x - brushSize, y - brushSize, brushSize * 2, brushSize * 2);
        }
      }
      
      setLastDrawPoint({ x, y });
      
    } else if (tool === TOOLS.TEXT && textInput) {
      if (!isPixelInUVMask(uvLayoutImage, Math.round(x), Math.round(y))) return;
      
      drawingCtx.fillStyle = brushColor;
      drawingCtx.font = `${fontSize}px Arial`;
      drawingCtx.fillText(textInput, x, y);
    }
    
    initUVCanvas();
  }, [lastDrawPoint, uvLayoutImage, initUVCanvas]);

  const saveToHistory = useCallback(() => {
    if (!drawingLayerRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(drawingLayerRef.current, 0, 0);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(canvas.toDataURL());
    
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    } else {
      setHistoryIndex(prev => prev + 1);
    }
    
    setHistory(newHistory);
  }, [history, historyIndex]);

  const restoreFromHistory = useCallback((index) => {
    const img = new Image();
    img.onload = () => {
      if (!drawingLayerRef.current) {
        drawingLayerRef.current = document.createElement('canvas');
        drawingLayerRef.current.width = CANVAS_SIZE;
        drawingLayerRef.current.height = CANVAS_SIZE;
      }
      const ctx = drawingLayerRef.current.getContext('2d');
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(img, 0, 0);
      initUVCanvas();
    };
    img.src = history[index];
  }, [history, initUVCanvas]);

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
    drawingLayerRef.current = null;
    setHistory([]);
    setHistoryIndex(-1);
    initUVCanvas();
  }, [initUVCanvas]);

  return {
    drawingLayerRef,
    isDrawing,
    setIsDrawing,
    lastDrawPoint,
    setLastDrawPoint,
    history,
    historyIndex,
    drawOnCanvas,
    saveToHistory,
    undo,
    redo,
    clearCanvas
  };
}