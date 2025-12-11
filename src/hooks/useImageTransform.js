import { useState, useCallback, useRef } from 'react';
import { CANVAS_SIZE } from '../utils/constants';

/**
 * Хук для работы с трансформацией изображения
 */
export function useImageTransform(drawingLayerRef, uvLayoutImage, saveToHistory, onCanvasUpdate) {
  const [designImage, setDesignImage] = useState(null);
  const [imageTransform, setImageTransform] = useState({
    x: 0, y: 0, scale: 1, rotation: 0
  });
  const [isTransformMode, setIsTransformMode] = useState(false);
  
  // Состояние для drag
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef(0);

  // Загрузка изображения из файла
  const handleImageUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setDesignImage(img);
        setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
        setIsTransformMode(true);
        
        setTimeout(() => {
          onCanvasUpdate(true);
        }, 0);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    
    event.target.value = '';
  }, [onCanvasUpdate]);

  // Прямая установка изображения (для AI генерации)
  const setDesignImageDirect = useCallback((img) => {
    if (!img) return;
    
    setDesignImage(img);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    setIsTransformMode(true);
    
    setTimeout(() => {
      onCanvasUpdate(true);
    }, 0);
  }, [onCanvasUpdate]);

  // Начало перетаскивания
  const startDrag = useCallback((x, y, touches) => {
    if (touches?.length === 2) {
      const t1 = touches[0];
      const t2 = touches[1];
      lastTouchDistanceRef.current = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY
      );
    } else {
      isDraggingRef.current = true;
      dragStartRef.current = {
        x: x - imageTransform.x,
        y: y - imageTransform.y
      };
    }
  }, [imageTransform.x, imageTransform.y]);

  // Перетаскивание
  const drag = useCallback((x, y, touches) => {
    if (touches?.length === 2) {
      const t1 = touches[0];
      const t2 = touches[1];
      const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      
      if (lastTouchDistanceRef.current > 0) {
        const scale = distance / lastTouchDistanceRef.current;
        setImageTransform(prev => ({
          ...prev,
          scale: Math.max(0.1, Math.min(3, prev.scale * scale))
        }));
      }
      lastTouchDistanceRef.current = distance;
      return true;
    }

    if (isDraggingRef.current) {
      setImageTransform(prev => ({
        ...prev,
        x: x - dragStartRef.current.x,
        y: y - dragStartRef.current.y
      }));
      return true;
    }
    
    return false;
  }, []);

  // Окончание перетаскивания
  const stopDrag = useCallback(() => {
    isDraggingRef.current = false;
    lastTouchDistanceRef.current = 0;
  }, []);

  // Применение изображения к canvas
  const applyImage = useCallback(() => {
    if (!designImage) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_SIZE;
    tempCanvas.height = CANVAS_SIZE;
    const tempCtx = tempCanvas.getContext('2d');
    
    const imgW = CANVAS_SIZE * imageTransform.scale;
    const imgH = CANVAS_SIZE * imageTransform.scale;
    const centerX = CANVAS_SIZE / 2 + imageTransform.x;
    const centerY = CANVAS_SIZE / 2 + imageTransform.y;
    
    tempCtx.save();
    tempCtx.translate(centerX, centerY);
    tempCtx.rotate(imageTransform.rotation * Math.PI / 180);
    tempCtx.drawImage(designImage, -imgW / 2, -imgH / 2, imgW, imgH);
    tempCtx.restore();
    
    if (uvLayoutImage) {
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    
    if (!drawingLayerRef.current) {
      drawingLayerRef.current = document.createElement('canvas');
      drawingLayerRef.current.width = CANVAS_SIZE;
      drawingLayerRef.current.height = CANVAS_SIZE;
    }
    
    const drawingCtx = drawingLayerRef.current.getContext('2d');
    drawingCtx.drawImage(tempCanvas, 0, 0);
    
    setDesignImage(null);
    setIsTransformMode(false);
    saveToHistory();
    onCanvasUpdate(true);
  }, [designImage, imageTransform, uvLayoutImage, drawingLayerRef, saveToHistory, onCanvasUpdate]);

  // ИСПРАВЛЕНО: Отмена трансформации с принудительным обновлением 3D модели
  const cancelTransform = useCallback(() => {
    // Сначала сбрасываем состояние
    setDesignImage(null);
    setIsTransformMode(false);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    
    // Используем setTimeout чтобы дождаться обновления state
    // и только потом обновить canvas и 3D текстуру
    setTimeout(() => {
      onCanvasUpdate(true);
      // Дополнительный вызов через RAF для гарантии синхронизации с 3D
      requestAnimationFrame(() => {
        onCanvasUpdate(true);
      });
    }, 0);
  }, [onCanvasUpdate]);

  // Сброс состояния изображения
  const resetImageState = useCallback(() => {
    setDesignImage(null);
    setIsTransformMode(false);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
  }, []);

  return {
    designImage,
    imageTransform,
    setImageTransform,
    isTransformMode,
    handleImageUpload,
    setDesignImageDirect,
    startDrag,
    drag,
    stopDrag,
    applyImage,
    cancelTransform,
    resetImageState
  };
}