import { useState, useCallback, useRef, useEffect } from 'react';
import { CANVAS_SIZE } from '../utils/constants';

/**
 * Хук для работы с трансформацией изображения (для системы слоёв)
 */
export function useImageTransformWithLayers(uvLayoutImage, addImageLayer, saveToHistory, onCanvasUpdate) {
  const [pendingImage, setPendingImage] = useState(null);
  const [imageTransform, setImageTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
  });
  const [isTransformMode, setIsTransformMode] = useState(false);
  
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef(0);
  
  const onCanvasUpdateRef = useRef(onCanvasUpdate);
  const saveToHistoryRef = useRef(saveToHistory);
  
  useEffect(() => {
    onCanvasUpdateRef.current = onCanvasUpdate;
  }, [onCanvasUpdate]);
  
  useEffect(() => {
    saveToHistoryRef.current = saveToHistory;
  }, [saveToHistory]);
  
  const triggerUpdate = useCallback((force = false) => {
    if (onCanvasUpdateRef.current) {
      onCanvasUpdateRef.current(force);
    }
  }, []);

  const handleImageUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setPendingImage(img);
        setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
        setIsTransformMode(true);
        requestAnimationFrame(() => triggerUpdate(true));
      };
      img.onerror = () => console.error('Ошибка загрузки изображения');
      img.src = e.target.result;
    };
    reader.onerror = () => console.error('Ошибка чтения файла');
    reader.readAsDataURL(file);
    event.target.value = '';
  }, [triggerUpdate]);

  const setDesignImageDirect = useCallback((img) => {
    if (!img) return;
    setPendingImage(img);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    setIsTransformMode(true);
    requestAnimationFrame(() => triggerUpdate(true));
  }, [triggerUpdate]);

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
        triggerUpdate();
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
      triggerUpdate();
      return true;
    }
    
    return false;
  }, [triggerUpdate]);

  const stopDrag = useCallback(() => {
    isDraggingRef.current = false;
    lastTouchDistanceRef.current = 0;
  }, []);

  const applyImage = useCallback(() => {
    if (!pendingImage) return;
    
    const currentTransform = { ...imageTransform };
    const currentImage = pendingImage;
    
    // Создаём временный canvas с трансформированным изображением
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_SIZE;
    tempCanvas.height = CANVAS_SIZE;
    const tempCtx = tempCanvas.getContext('2d');
    
    const imgW = CANVAS_SIZE * currentTransform.scale;
    const imgH = CANVAS_SIZE * currentTransform.scale;
    const centerX = CANVAS_SIZE / 2 + currentTransform.x;
    const centerY = CANVAS_SIZE / 2 + currentTransform.y;
    
    tempCtx.save();
    tempCtx.translate(centerX, centerY);
    tempCtx.rotate(currentTransform.rotation * Math.PI / 180);
    tempCtx.drawImage(currentImage, -imgW / 2, -imgH / 2, imgW, imgH);
    tempCtx.restore();
    
    // Применяем UV маску
    if (uvLayoutImage) {
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    
    // Создаём новый слой с изображением
    const newLayer = addImageLayer(currentImage, currentTransform);
    
    if (newLayer && newLayer.ctx) {
      newLayer.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      newLayer.ctx.drawImage(tempCanvas, 0, 0);
    }
    
    // Сброс состояния
    setPendingImage(null);
    setIsTransformMode(false);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    
    // ВАЖНО: Используем setTimeout чтобы дождаться обновления layers в useLayers
    // перед сохранением в историю. Это гарантирует, что новый слой
    // будет включён в snapshot истории.
    setTimeout(() => {
      if (saveToHistoryRef.current) {
        saveToHistoryRef.current();
      }
      triggerUpdate(true);
    }, 50);
  }, [pendingImage, imageTransform, uvLayoutImage, addImageLayer, triggerUpdate]);

  const cancelTransform = useCallback(() => {
    setPendingImage(null);
    setIsTransformMode(false);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    triggerUpdate(true);
  }, [triggerUpdate]);

  const resetImageState = useCallback(() => {
    setPendingImage(null);
    setIsTransformMode(false);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
  }, []);

  return {
    pendingImage,
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