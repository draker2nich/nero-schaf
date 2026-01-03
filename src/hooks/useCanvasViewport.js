/**
 * Хук для управления viewport холста
 * 
 * Реализует:
 * - Зум колёсиком мыши (Ctrl+колёсико или просто колёсико)
 * - Панорамирование при зажатом пробеле или средней кнопке
 * - Pinch-to-zoom на тачскринах
 * - Fit to view
 * - Центрирование
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { CANVAS_SIZE, CANVAS_ZOOM } from '../utils/constants';

export function useCanvasViewport(containerRef) {
  // Состояние viewport
  const [viewport, setViewport] = useState({
    zoom: CANVAS_ZOOM.DEFAULT,
    panX: 0,
    panY: 0
  });
  
  // Режим панорамирования
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  
  // Refs для отслеживания состояния
  const panStartRef = useRef({ x: 0, y: 0, viewportX: 0, viewportY: 0 });
  const lastTouchDistanceRef = useRef(0);
  const lastTouchCenterRef = useRef({ x: 0, y: 0 });
  
  /**
   * Зум с центром в указанной точке
   */
  const zoomAt = useCallback((newZoom, centerX, centerY) => {
    setViewport(prev => {
      const clampedZoom = Math.max(CANVAS_ZOOM.MIN, Math.min(CANVAS_ZOOM.MAX, newZoom));
      
      // Вычисляем смещение для сохранения центра зума
      const zoomRatio = clampedZoom / prev.zoom;
      
      // Позиция центра в координатах холста
      const canvasX = (centerX - prev.panX) / prev.zoom;
      const canvasY = (centerY - prev.panY) / prev.zoom;
      
      // Новое смещение для сохранения точки под курсором
      const newPanX = centerX - canvasX * clampedZoom;
      const newPanY = centerY - canvasY * clampedZoom;
      
      return {
        zoom: clampedZoom,
        panX: newPanX,
        panY: newPanY
      };
    });
  }, []);

  /**
   * Зум на определённый процент
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
    setViewport(prev => ({
      ...prev,
      zoom: Math.min(CANVAS_ZOOM.MAX, prev.zoom + CANVAS_ZOOM.STEP)
    }));
  }, []);

  /**
   * Уменьшение зума
   */
  const zoomOut = useCallback(() => {
    setViewport(prev => ({
      ...prev,
      zoom: Math.max(CANVAS_ZOOM.MIN, prev.zoom - CANVAS_ZOOM.STEP)
    }));
  }, []);

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
    
    setViewport({
      zoom: 1,
      panX,
      panY
    });
  }, [containerRef]);

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
    
    setViewport(prev => ({
      ...prev,
      panX: panStartRef.current.viewportX + deltaX,
      panY: panStartRef.current.viewportY + deltaY
    }));
  }, [isPanning]);

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

  return {
    viewport,
    isPanning,
    spacePressed,
    
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
    
    // Проверка режима
    shouldPan: spacePressed || isPanning
  };
}

export default useCanvasViewport;
