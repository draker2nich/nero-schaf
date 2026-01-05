/**
 * Хук для управления viewport холста
 * 
 * Исправления:
 * - Автоматическое центрирование при инициализации
 * - Корректный зум относительно курсора
 * - Ограничение панорамирования (холст не уходит за пределы)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { CANVAS_SIZE, CANVAS_ZOOM } from '../utils/constants';

export function useCanvasViewport(containerRef) {
  const [viewport, setViewport] = useState({
    zoom: CANVAS_ZOOM.DEFAULT,
    panX: 0,
    panY: 0
  });
  
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const panStartRef = useRef({ x: 0, y: 0, viewportX: 0, viewportY: 0 });
  const lastTouchDistanceRef = useRef(0);
  const lastTouchCenterRef = useRef({ x: 0, y: 0 });

  /**
   * Центрирование холста при инициализации
   */
  useEffect(() => {
    if (!containerRef.current || isInitialized) return;
    
    const observer = new ResizeObserver((entries) => {
      if (!isInitialized && entries[0]) {
        const rect = entries[0].contentRect;
        if (rect.width > 0 && rect.height > 0) {
          // Вычисляем оптимальный зум для вписывания
          const padding = CANVAS_ZOOM.FIT_PADDING * 2;
          const scaleX = (rect.width - padding) / CANVAS_SIZE;
          const scaleY = (rect.height - padding) / CANVAS_SIZE;
          const fitZoom = Math.min(scaleX, scaleY, 1);
          
          // Центрируем
          const panX = (rect.width - CANVAS_SIZE * fitZoom) / 2;
          const panY = (rect.height - CANVAS_SIZE * fitZoom) / 2;
          
          setViewport({
            zoom: fitZoom,
            panX,
            panY
          });
          setIsInitialized(true);
        }
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, isInitialized]);

  /**
   * Ограничение панорамирования - холст не должен полностью уходить за пределы
   */
  const clampPan = useCallback((panX, panY, zoom) => {
    if (!containerRef.current) return { panX, panY };
    
    const rect = containerRef.current.getBoundingClientRect();
    const canvasWidth = CANVAS_SIZE * zoom;
    const canvasHeight = CANVAS_SIZE * zoom;
    
    // Минимум 20% холста должно быть видно
    const minVisible = 0.2;
    const minX = -canvasWidth * (1 - minVisible);
    const maxX = rect.width - canvasWidth * minVisible;
    const minY = -canvasHeight * (1 - minVisible);
    const maxY = rect.height - canvasHeight * minVisible;
    
    return {
      panX: Math.max(minX, Math.min(maxX, panX)),
      panY: Math.max(minY, Math.min(maxY, panY))
    };
  }, [containerRef]);

  /**
   * Зум с центром в указанной точке (относительно контейнера)
   */
  const zoomAt = useCallback((newZoom, centerX, centerY) => {
    setViewport(prev => {
      const clampedZoom = Math.max(CANVAS_ZOOM.MIN, Math.min(CANVAS_ZOOM.MAX, newZoom));
      
      // Позиция в координатах холста до зума
      const canvasX = (centerX - prev.panX) / prev.zoom;
      const canvasY = (centerY - prev.panY) / prev.zoom;
      
      // Новое смещение для сохранения точки под курсором
      let newPanX = centerX - canvasX * clampedZoom;
      let newPanY = centerY - canvasY * clampedZoom;
      
      // Ограничиваем панорамирование
      const clamped = clampPan(newPanX, newPanY, clampedZoom);
      
      return {
        zoom: clampedZoom,
        panX: clamped.panX,
        panY: clamped.panY
      };
    });
  }, [clampPan]);

  /**
   * Зум на определённый процент (относительно центра контейнера)
   */
  const zoomTo = useCallback((zoomLevel) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    zoomAt(zoomLevel, centerX, centerY);
  }, [containerRef, zoomAt]);

  /**
   * Увеличение зума
   */
  const zoomIn = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    setViewport(prev => {
      const newZoom = Math.min(CANVAS_ZOOM.MAX, prev.zoom + CANVAS_ZOOM.STEP);
      
      const canvasX = (centerX - prev.panX) / prev.zoom;
      const canvasY = (centerY - prev.panY) / prev.zoom;
      
      let newPanX = centerX - canvasX * newZoom;
      let newPanY = centerY - canvasY * newZoom;
      
      const clamped = clampPan(newPanX, newPanY, newZoom);
      
      return {
        zoom: newZoom,
        panX: clamped.panX,
        panY: clamped.panY
      };
    });
  }, [containerRef, clampPan]);

  /**
   * Уменьшение зума
   */
  const zoomOut = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    setViewport(prev => {
      const newZoom = Math.max(CANVAS_ZOOM.MIN, prev.zoom - CANVAS_ZOOM.STEP);
      
      const canvasX = (centerX - prev.panX) / prev.zoom;
      const canvasY = (centerY - prev.panY) / prev.zoom;
      
      let newPanX = centerX - canvasX * newZoom;
      let newPanY = centerY - canvasY * newZoom;
      
      const clamped = clampPan(newPanX, newPanY, newZoom);
      
      return {
        zoom: newZoom,
        panX: clamped.panX,
        panY: clamped.panY
      };
    });
  }, [containerRef, clampPan]);

  /**
   * Fit to view - масштабирование для заполнения контейнера
   */
  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const padding = CANVAS_ZOOM.FIT_PADDING * 2;
    
    const scaleX = (rect.width - padding) / CANVAS_SIZE;
    const scaleY = (rect.height - padding) / CANVAS_SIZE;
    const scale = Math.min(scaleX, scaleY, CANVAS_ZOOM.MAX);
    
    const panX = (rect.width - CANVAS_SIZE * scale) / 2;
    const panY = (rect.height - CANVAS_SIZE * scale) / 2;
    
    setViewport({
      zoom: scale,
      panX,
      panY
    });
  }, [containerRef]);

  /**
   * Сброс к 100%
   */
  const resetZoom = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const panX = (rect.width - CANVAS_SIZE) / 2;
    const panY = (rect.height - CANVAS_SIZE) / 2;
    
    const clamped = clampPan(panX, panY, 1);
    
    setViewport({
      zoom: 1,
      panX: clamped.panX,
      panY: clamped.panY
    });
  }, [containerRef, clampPan]);

  /**
   * Центрирование холста
   */
  const center = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    
    setViewport(prev => ({
      ...prev,
      panX: (rect.width - CANVAS_SIZE * prev.zoom) / 2,
      panY: (rect.height - CANVAS_SIZE * prev.zoom) / 2
    }));
  }, [containerRef]);

  /**
   * Начало панорамирования
   */
  const startPan = useCallback((clientX, clientY) => {
    setIsPanning(true);
    panStartRef.current = {
      x: clientX,
      y: clientY,
      viewportX: viewport.panX,
      viewportY: viewport.panY
    };
  }, [viewport.panX, viewport.panY]);

  /**
   * Панорамирование
   */
  const pan = useCallback((clientX, clientY) => {
    if (!isPanning) return;
    
    const deltaX = clientX - panStartRef.current.x;
    const deltaY = clientY - panStartRef.current.y;
    
    const newPanX = panStartRef.current.viewportX + deltaX;
    const newPanY = panStartRef.current.viewportY + deltaY;
    
    const clamped = clampPan(newPanX, newPanY, viewport.zoom);
    
    setViewport(prev => ({
      ...prev,
      panX: clamped.panX,
      panY: clamped.panY
    }));
  }, [isPanning, viewport.zoom, clampPan]);

  /**
   * Окончание панорамирования
   */
  const endPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  /**
   * Обработка колёсика мыши
   */
  const handleWheel = useCallback((e) => {
    if (!containerRef.current) return;
    
    e.preventDefault();
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Определяем направление и величину зума
    const delta = -e.deltaY * 0.001;
    const newZoom = viewport.zoom * (1 + delta);
    
    zoomAt(newZoom, mouseX, mouseY);
  }, [containerRef, viewport.zoom, zoomAt]);

  /**
   * Обработка тач-событий для pinch-to-zoom
   */
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      
      lastTouchDistanceRef.current = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY
      );
      
      lastTouchCenterRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
      };
    }
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      
      const distance = Math.hypot(
        t2.clientX - t1.clientX,
        t2.clientY - t1.clientY
      );
      
      const center = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
      };
      
      if (lastTouchDistanceRef.current > 0) {
        const scale = distance / lastTouchDistanceRef.current;
        const newZoom = viewport.zoom * scale;
        
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          zoomAt(newZoom, center.x - rect.left, center.y - rect.top);
        }
      }
      
      lastTouchDistanceRef.current = distance;
      lastTouchCenterRef.current = center;
    }
  }, [containerRef, viewport.zoom, zoomAt]);

  /**
   * Обработка клавиш (пробел для панорамирования)
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpacePressed(true);
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
        endPan();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [endPan]);

  /**
   * Преобразование координат экрана в координаты холста
   */
  const screenToCanvas = useCallback((screenX, screenY) => {
    return {
      x: (screenX - viewport.panX) / viewport.zoom,
      y: (screenY - viewport.panY) / viewport.zoom
    };
  }, [viewport]);

  /**
   * Преобразование координат холста в координаты экрана
   */
  const canvasToScreen = useCallback((canvasX, canvasY) => {
    return {
      x: canvasX * viewport.zoom + viewport.panX,
      y: canvasY * viewport.zoom + viewport.panY
    };
  }, [viewport]);

  /**
   * Получение границ видимой области холста
   */
  const getVisibleBounds = useCallback(() => {
    if (!containerRef.current) return null;
    
    const rect = containerRef.current.getBoundingClientRect();
    const topLeft = screenToCanvas(0, 0);
    const bottomRight = screenToCanvas(rect.width, rect.height);
    
    return {
      left: Math.max(0, topLeft.x),
      top: Math.max(0, topLeft.y),
      right: Math.min(CANVAS_SIZE, bottomRight.x),
      bottom: Math.min(CANVAS_SIZE, bottomRight.y)
    };
  }, [containerRef, screenToCanvas]);

  return {
    viewport,
    isPanning,
    spacePressed,
    isInitialized,
    
    // Зум
    zoomAt,
    zoomTo,
    zoomIn,
    zoomOut,
    fitToView,
    resetZoom,
    
    // Панорамирование
    center,
    startPan,
    pan,
    endPan,
    
    // Обработчики событий
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    
    // Преобразование координат
    screenToCanvas,
    canvasToScreen,
    getVisibleBounds,
    
    // Проверка режима
    shouldPan: spacePressed || isPanning
  };
}

export default useCanvasViewport;