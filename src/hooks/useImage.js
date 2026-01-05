import { useState, useCallback, useRef, useEffect } from 'react';
import { CANVAS_SIZE } from '../utils/constants';

// Лимиты для загружаемых изображений
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB для HQ изображений
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff', 'image/bmp'];

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
      error: 'Недопустимый формат. Разрешены: JPEG, PNG, WebP, GIF, TIFF, BMP' 
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
 * Вычисление информации о качестве изображения
 */
function calculateQualityInfo(img, scale, canvasSize) {
  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;
  
  // Размер изображения на canvas при текущем масштабе
  const displaySize = canvasSize * scale;
  
  // Эффективный DPI
  const effectivePixelsPerCanvasPixel = Math.min(originalWidth, originalHeight) / displaySize;
  
  // Предполагаем печать на ~10 дюймов
  const printSizeInches = 10;
  const currentDpi = Math.round((Math.min(originalWidth, originalHeight) / scale) / printSizeInches);
  
  let status, label, message;
  
  if (effectivePixelsPerCanvasPixel >= 1) {
    status = 'good';
    label = 'Отличное качество';
    message = 'Изображение имеет достаточное разрешение.';
  } else if (effectivePixelsPerCanvasPixel >= 0.5) {
    status = 'warning';
    label = 'Среднее качество';
    message = `Изображение немного растянуто (${Math.round(effectivePixelsPerCanvasPixel * 100)}%). Рекомендуется уменьшить масштаб.`;
  } else {
    status = 'bad';
    label = 'Низкое качество';
    message = `Изображение сильно растянуто (${Math.round(effectivePixelsPerCanvasPixel * 100)}%). Результат будет размытым.`;
  }
  
  const maxRecommendedScale = Math.min(originalWidth, originalHeight) / canvasSize;
  
  return {
    status,
    label,
    message,
    originalWidth,
    originalHeight,
    currentDpi,
    effectivePixelsPerCanvasPixel,
    maxRecommendedScale: Math.min(maxRecommendedScale, 3),
    isUpscaled: effectivePixelsPerCanvasPixel < 1
  };
}

/**
 * Загрузка изображения из файла БЕЗ ресайза
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
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось загрузить изображение.'));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}

/**
 * Хук для работы с трансформацией изображения
 */
export function useImageTransformWithLayers(uvLayoutImage, addImageLayer, saveToHistory, onCanvasUpdate) {
  const [pendingImage, setPendingImage] = useState(null);
  const [imageTransform, setImageTransform] = useState({ x: 0, y: 0, scale: 1, rotation: 0 });
  const [isTransformMode, setIsTransformMode] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [qualityInfo, setQualityInfo] = useState(null);
  
  const originalImageRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const lastTouchDistanceRef = useRef(0);
  
  const onCanvasUpdateRef = useRef(onCanvasUpdate);
  const saveToHistoryRef = useRef(saveToHistory);
  
  useEffect(() => { onCanvasUpdateRef.current = onCanvasUpdate; }, [onCanvasUpdate]);
  useEffect(() => { saveToHistoryRef.current = saveToHistory; }, [saveToHistory]);
  
  // Обновление качества при изменении масштаба
  useEffect(() => {
    if (originalImageRef.current && isTransformMode) {
      const info = calculateQualityInfo(originalImageRef.current, imageTransform.scale, CANVAS_SIZE);
      setQualityInfo(info);
    }
  }, [imageTransform.scale, isTransformMode]);
  
  const triggerUpdate = useCallback((force = false) => {
    if (onCanvasUpdateRef.current) onCanvasUpdateRef.current(force);
  }, []);

  const handleImageUpload = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadError(null);
    
    try {
      const img = await loadImageFromFile(file);
      
      originalImageRef.current = img;
      
      const originalWidth = img.naturalWidth || img.width;
      const originalHeight = img.naturalHeight || img.height;
      const fitScale = Math.min(CANVAS_SIZE / originalWidth, CANVAS_SIZE / originalHeight, 1);
      
      setPendingImage(img);
      setImageTransform({ x: 0, y: 0, scale: fitScale, rotation: 0 });
      setIsTransformMode(true);
      
      const info = calculateQualityInfo(img, fitScale, CANVAS_SIZE);
      setQualityInfo(info);
      
      requestAnimationFrame(() => triggerUpdate(true));
    } catch (err) {
      console.error('Image upload error:', err);
      setUploadError(err.message);
      setTimeout(() => setUploadError(null), 5000);
    }
    
    event.target.value = '';
  }, [triggerUpdate]);

  const setDesignImageDirect = useCallback((img) => {
    if (!img) return;
    
    originalImageRef.current = img;
    
    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;
    const fitScale = Math.min(CANVAS_SIZE / originalWidth, CANVAS_SIZE / originalHeight, 1);
    
    setPendingImage(img);
    setImageTransform({ x: 0, y: 0, scale: fitScale, rotation: 0 });
    setIsTransformMode(true);
    setUploadError(null);
    
    const info = calculateQualityInfo(img, fitScale, CANVAS_SIZE);
    setQualityInfo(info);
    
    requestAnimationFrame(() => triggerUpdate(true));
  }, [triggerUpdate]);

  const startDrag = useCallback((x, y, touches) => {
    if (touches?.length === 2) {
      const t1 = touches[0];
      const t2 = touches[1];
      lastTouchDistanceRef.current = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    } else {
      isDraggingRef.current = true;
      dragStartRef.current = { x: x - imageTransform.x, y: y - imageTransform.y };
    }
  }, [imageTransform.x, imageTransform.y]);

  const drag = useCallback((x, y, touches) => {
    if (touches?.length === 2) {
      const t1 = touches[0];
      const t2 = touches[1];
      const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      
      if (lastTouchDistanceRef.current > 0) {
        const scale = distance / lastTouchDistanceRef.current;
        setImageTransform(prev => ({ ...prev, scale: Math.max(0.1, Math.min(5, prev.scale * scale)) }));
        triggerUpdate();
      }
      lastTouchDistanceRef.current = distance;
      return true;
    }

    if (isDraggingRef.current) {
      setImageTransform(prev => ({ ...prev, x: x - dragStartRef.current.x, y: y - dragStartRef.current.y }));
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
    const originalImg = originalImageRef.current;
    if (!originalImg) return;
    
    const currentTransform = { ...imageTransform };
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_SIZE;
    tempCanvas.height = CANVAS_SIZE;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.imageSmoothingEnabled = true;
    tempCtx.imageSmoothingQuality = 'high';
    
    const originalWidth = originalImg.naturalWidth || originalImg.width;
    const originalHeight = originalImg.naturalHeight || originalImg.height;
    
    const imgW = CANVAS_SIZE * currentTransform.scale;
    const imgH = CANVAS_SIZE * currentTransform.scale * (originalHeight / originalWidth);
    
    const centerX = CANVAS_SIZE / 2 + currentTransform.x;
    const centerY = CANVAS_SIZE / 2 + currentTransform.y;
    
    tempCtx.save();
    tempCtx.translate(centerX, centerY);
    tempCtx.rotate(currentTransform.rotation * Math.PI / 180);
    tempCtx.drawImage(originalImg, -imgW / 2, -imgH / 2, imgW, imgH);
    tempCtx.restore();
    
    if (uvLayoutImage) {
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    
    const newLayer = addImageLayer(originalImg, currentTransform);
    
    if (newLayer && newLayer.ctx) {
      newLayer.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      newLayer.ctx.drawImage(tempCanvas, 0, 0);
    }
    
    setPendingImage(null);
    setIsTransformMode(false);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    setQualityInfo(null);
    originalImageRef.current = null;
    
    setTimeout(() => {
      if (saveToHistoryRef.current) saveToHistoryRef.current();
      triggerUpdate(true);
    }, 50);
  }, [imageTransform, uvLayoutImage, addImageLayer, triggerUpdate]);

  const cancelTransform = useCallback(() => {
    setPendingImage(null);
    setIsTransformMode(false);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    setUploadError(null);
    setQualityInfo(null);
    originalImageRef.current = null;
    triggerUpdate(true);
  }, [triggerUpdate]);

  const resetImageState = useCallback(() => {
    setPendingImage(null);
    setIsTransformMode(false);
    setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
    setUploadError(null);
    setQualityInfo(null);
    originalImageRef.current = null;
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
    qualityInfo,
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