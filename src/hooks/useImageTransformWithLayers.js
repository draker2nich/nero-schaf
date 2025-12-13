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
  
  // Состояние для drag
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef(0);
  
  // Храним актуальный callback в ref
  const onCanvasUpdateRef = useRef(onCanvasUpdate);
  useEffect(() => {
    onCanvasUpdateRef.current = onCanvasUpdate;
  }, [onCanvasUpdate]);
  
  // Вызов обновления
  const triggerUpdate = useCallback((force = false) => {
    if (onCanvasUpdateRef.current) {
      onCanvasUpdateRef.current(force);
    }
  }, []);

  // Загрузка изображения из файла
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
        // Обновляем после установки состояния
        requestAnimationFrame(() => triggerUpdate(true));
      };
      img.onerror = () => {
        console.error('Ошибка загрузки изображения');
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      console.error('Ошибка чтения файла');
    };
    reader.readAsDataURL(file);
    
    // Сброс input для повторной загрузки того же файла
    event.target.value = '';
  }, [triggerUpdate]);

  // Прямая установка изображения (для AI генерации)
  const setDesignImageDirect = useCallback((img) => {
    if (!img) return;
    
    setPendingImage(img);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    setIsTransformMode(true);
    // Обновляем после установки состояния
    requestAnimationFrame(() => triggerUpdate(true));
  }, [triggerUpdate]);

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
        setImageTransform(prev => {
          const newTransform = {
            ...prev,
            scale: Math.max(0.1, Math.min(3, prev.scale * scale))
          };
          return newTransform;
        });
        triggerUpdate();
      }
      lastTouchDistanceRef.current = distance;
      return true;
    }

    if (isDraggingRef.current) {
      setImageTransform(prev => {
        const newTransform = {
          ...prev,
          x: x - dragStartRef.current.x,
          y: y - dragStartRef.current.y
        };
        return newTransform;
      });
      triggerUpdate();
      return true;
    }
    
    return false;
  }, [triggerUpdate]);

  // Окончание перетаскивания
  const stopDrag = useCallback(() => {
    isDraggingRef.current = false;
    lastTouchDistanceRef.current = 0;
  }, []);

  // Применение изображения как нового слоя
  const applyImage = useCallback(() => {
    if (!pendingImage) return;
    
    // Создаём временный canvas с трансформированным изображением
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
    tempCtx.drawImage(pendingImage, -imgW / 2, -imgH / 2, imgW, imgH);
    tempCtx.restore();
    
    // Применяем UV маску
    if (uvLayoutImage) {
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    
    // Создаём новый слой с изображением
    const newLayer = addImageLayer(pendingImage, imageTransform);
    
    if (newLayer && newLayer.ctx) {
      // Копируем результат на canvas слоя
      newLayer.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      newLayer.ctx.drawImage(tempCanvas, 0, 0);
    }
    
    // Сброс состояния
    setPendingImage(null);
    setIsTransformMode(false);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    
    if (saveToHistory) {
      saveToHistory();
    }
    
    // Принудительное обновление после применения
    requestAnimationFrame(() => triggerUpdate(true));
  }, [pendingImage, imageTransform, uvLayoutImage, addImageLayer, saveToHistory, triggerUpdate]);

  // Отмена трансформации
  const cancelTransform = useCallback(() => {
    setPendingImage(null);
    setIsTransformMode(false);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    triggerUpdate(true);
  }, [triggerUpdate]);

  // Сброс состояния изображения
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