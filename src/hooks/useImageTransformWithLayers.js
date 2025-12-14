import { useState, useCallback, useRef, useEffect } from 'react';
import { CANVAS_SIZE } from '../utils/constants';

// Лимиты для загружаемых изображений
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_DIMENSION = 2048;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Валидация файла
 */
function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'Файл не выбран' };
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { 
      valid: false, 
      error: 'Недопустимый формат. Разрешены: JPEG, PNG, WebP, GIF' 
    };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `Файл слишком большой. Максимум ${MAX_FILE_SIZE / 1024 / 1024}MB` 
    };
  }
  
  return { valid: true };
}

/**
 * Ресайз изображения на клиенте
 */
function resizeImage(img, maxDim = MAX_IMAGE_DIMENSION) {
  let { naturalWidth: width, naturalHeight: height } = img;
  
  // Если изображение уже подходит по размеру
  if (width <= maxDim && height <= maxDim) {
    return img;
  }
  
  // Вычисляем новые размеры
  const scale = Math.min(maxDim / width, maxDim / height);
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);
  
  // Создаём canvas для ресайза
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, newWidth, newHeight);
  
  // Создаём новое изображение
  const resizedImg = new Image();
  resizedImg.src = canvas.toDataURL('image/jpeg', 0.9);
  resizedImg.width = newWidth;
  resizedImg.height = newHeight;
  
  return resizedImg;
}

/**
 * Загрузка изображения из файла с ресайзом
 */
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      reject(new Error(validation.error));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Ресайзим если нужно
        const processedImg = resizeImage(img);
        resolve(processedImg);
      };
      
      img.onerror = () => {
        reject(new Error('Не удалось загрузить изображение. Файл повреждён?'));
      };
      
      img.src = e.target.result;
    };
    
    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'));
    };
    
    reader.readAsDataURL(file);
  });
}

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
  const [uploadError, setUploadError] = useState(null);
  
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

  const handleImageUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    // Сбрасываем предыдущую ошибку
    setUploadError(null);
    
    try {
      const img = await loadImageFromFile(file);
      
      setPendingImage(img);
      setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
      setIsTransformMode(true);
      requestAnimationFrame(() => triggerUpdate(true));
      
    } catch (err) {
      console.error('Image upload error:', err);
      setUploadError(err.message);
      
      // Автоматически скрываем ошибку через 5 секунд
      setTimeout(() => setUploadError(null), 5000);
    }
    
    // Очищаем input для повторной загрузки того же файла
    event.target.value = '';
  }, [triggerUpdate]);

  const setDesignImageDirect = useCallback((img) => {
    if (!img) return;
    
    // Ресайзим если нужно
    const processedImg = resizeImage(img);
    
    setPendingImage(processedImg);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    setIsTransformMode(true);
    setUploadError(null);
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
    setUploadError(null);
    triggerUpdate(true);
  }, [triggerUpdate]);

  const resetImageState = useCallback(() => {
    setPendingImage(null);
    setIsTransformMode(false);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    setUploadError(null);
  }, []);

  const clearUploadError = useCallback(() => {
    setUploadError(null);
  }, []);

  return {
    pendingImage,
    imageTransform,
    setImageTransform,
    isTransformMode,
    uploadError,
    handleImageUpload,
    setDesignImageDirect,
    startDrag,
    drag,
    stopDrag,
    applyImage,
    cancelTransform,
    resetImageState,
    clearUploadError
  };
}