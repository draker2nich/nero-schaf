/**
 * Хук для управления viewport холста
 * 
 * Оптимизации для мобильных:
 * - Улучшенный pinch-to-zoom
 * - Автоматический fit при инициализации
 * - Плавные анимации
 * - Инерция при свайпе
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { CANVAS_SIZE, CANVAS_ZOOM } from '../utils/constants';

export function useCanvasViewport(containerRef, isMobile = false) {
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
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastMoveTimeRef = useRef(0);
  const animationFrameRef = useRef(null);
  const isPinchingRef = useRef(false);

  // Инициализация с автоматическим fit
  useEffect(() => {
    if (!containerRef.current || isInitialized) return;
    
    const observer = new ResizeObserver((entries) => {
      if (!isInitialized && entries[0]) {
        const rect = entries[0].contentRect;
        if (rect.width > 0 && rect.height > 0) {
          const padding = isMobile ? 16 : CANVAS_ZOOM.FIT_PADDING * 2;
          const scaleX = (rect.width - padding) / CANVAS_SIZE;
          const scaleY = (rect.height - padding) / CANVAS_SIZE;
          // На мобильных делаем чуть меньше для удобства
          const fitZoom = Math.min(scaleX, scaleY, isMobile ? 0.9 : 1);
          
          const panX = (rect.width - CANVAS_SIZE * fitZoom) / 2;
          const panY = (rect.height - CANVAS_SIZE * fitZoom) / 2;
          
          setViewport({ zoom: fitZoom, panX, panY });
          setIsInitialized(true);
        }
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [containerRef, isInitialized, isMobile]);

  // Ограничение панорамирования
  const clampPan = useCallback((panX, panY, zoom) => {
    if (!containerRef.current) return { panX, panY };
    
    const rect = containerRef.current.getBoundingClientRect();
    const canvasWidth = CANVAS_SIZE * zoom;
    const canvasHeight = CANVAS_SIZE * zoom;
    
    // На мобильных разрешаем больше свободы
    const minVisible = isMobile ? 0.15 : 0.2;
    const minX = -canvasWidth * (1 - minVisible);
    const maxX = rect.width - canvasWidth * minVisible;
    const minY = -canvasHeight * (1 - minVisible);
    const maxY = rect.height - canvasHeight * minVisible;
    
    return {
      panX: Math.max(minX, Math.min(maxX, panX)),
      panY: Math.max(minY, Math.min(maxY, panY))
    };
  }, [containerRef, isMobile]);

  // Зум в точку
  const zoomAt = useCallback((newZoom, centerX, centerY) => {
    setViewport(prev => {
      // На мобильных расширяем диапазон зума
      const minZoom = isMobile ? 0.2 : CANVAS_ZOOM.MIN;
      const maxZoom = isMobile ? 5.0 : CANVAS_ZOOM.MAX;
      const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));
      
      const canvasX = (centerX - prev.panX) / prev.zoom;
      const canvasY = (centerY - prev.panY) / prev.zoom;
      
      let newPanX = centerX - canvasX * clampedZoom;
      let newPanY = centerY - canvasY * clampedZoom;
      
      const clamped = clampPan(newPanX, newPanY, clampedZoom);
      
      return { zoom: clampedZoom, panX: clamped.panX, panY: clamped.panY };
    });
  }, [clampPan, isMobile]);

  const zoomTo = useCallback((zoomLevel) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    zoomAt(zoomLevel, rect.width / 2, rect.height / 2);
  }, [containerRef, zoomAt]);

  const zoomIn = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const step = isMobile ? 0.15 : CANVAS_ZOOM.STEP;
    
    setViewport(prev => {
      const newZoom = Math.min(isMobile ? 5.0 : CANVAS_ZOOM.MAX, prev.zoom + step);
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const canvasX = (centerX - prev.panX) / prev.zoom;
      const canvasY = (centerY - prev.panY) / prev.zoom;
      
      const clamped = clampPan(centerX - canvasX * newZoom, centerY - canvasY * newZoom, newZoom);
      return { zoom: newZoom, panX: clamped.panX, panY: clamped.panY };
    });
  }, [containerRef, clampPan, isMobile]);

  const zoomOut = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const step = isMobile ? 0.15 : CANVAS_ZOOM.STEP;
    
    setViewport(prev => {
      const newZoom = Math.max(isMobile ? 0.2 : CANVAS_ZOOM.MIN, prev.zoom - step);
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const canvasX = (centerX - prev.panX) / prev.zoom;
      const canvasY = (centerY - prev.panY) / prev.zoom;
      
      const clamped = clampPan(centerX - canvasX * newZoom, centerY - canvasY * newZoom, newZoom);
      return { zoom: newZoom, panX: clamped.panX, panY: clamped.panY };
    });
  }, [containerRef, clampPan, isMobile]);

  const fitToView = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const padding = isMobile ? 16 : CANVAS_ZOOM.FIT_PADDING * 2;
    
    const scaleX = (rect.width - padding) / CANVAS_SIZE;
    const scaleY = (rect.height - padding) / CANVAS_SIZE;
    const scale = Math.min(scaleX, scaleY, isMobile ? 5.0 : CANVAS_ZOOM.MAX);
    
    const panX = (rect.width - CANVAS_SIZE * scale) / 2;
    const panY = (rect.height - CANVAS_SIZE * scale) / 2;
    
    setViewport({ zoom: scale, panX, panY });
  }, [containerRef, isMobile]);

  const resetZoom = useCallback(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const panX = (rect.width - CANVAS_SIZE) / 2;
    const panY = (rect.height - CANVAS_SIZE) / 2;
    
    const clamped = clampPan(panX, panY, 1);
    setViewport({ zoom: 1, panX: clamped.panX, panY: clamped.panY });
  }, [containerRef, clampPan]);

  const center = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setViewport(prev => ({
      ...prev,
      panX: (rect.width - CANVAS_SIZE * prev.zoom) / 2,
      panY: (rect.height - CANVAS_SIZE * prev.zoom) / 2
    }));
  }, [containerRef]);

  const startPan = useCallback((clientX, clientY) => {
    setIsPanning(true);
    velocityRef.current = { x: 0, y: 0 };
    lastMoveTimeRef.current = Date.now();
    panStartRef.current = {
      x: clientX,
      y: clientY,
      viewportX: viewport.panX,
      viewportY: viewport.panY
    };
  }, [viewport.panX, viewport.panY]);

  const pan = useCallback((clientX, clientY) => {
    if (!isPanning) return;
    
    const now = Date.now();
    const dt = now - lastMoveTimeRef.current;
    
    const deltaX = clientX - panStartRef.current.x;
    const deltaY = clientY - panStartRef.current.y;
    
    // Вычисляем скорость для инерции на мобильных
    if (isMobile && dt > 0) {
      velocityRef.current = {
        x: deltaX / dt * 16,
        y: deltaY / dt * 16
      };
    }
    lastMoveTimeRef.current = now;
    
    const newPanX = panStartRef.current.viewportX + deltaX;
    const newPanY = panStartRef.current.viewportY + deltaY;
    
    const clamped = clampPan(newPanX, newPanY, viewport.zoom);
    setViewport(prev => ({ ...prev, panX: clamped.panX, panY: clamped.panY }));
  }, [isPanning, viewport.zoom, clampPan, isMobile]);

  // Инерция при отпускании на мобильных
  const applyInertia = useCallback(() => {
    if (!isMobile) return;
    
    const friction = 0.92;
    const minVelocity = 0.5;
    
    const animate = () => {
      const vx = velocityRef.current.x;
      const vy = velocityRef.current.y;
      
      if (Math.abs(vx) < minVelocity && Math.abs(vy) < minVelocity) {
        velocityRef.current = { x: 0, y: 0 };
        return;
      }
      
      velocityRef.current = { x: vx * friction, y: vy * friction };
      
      setViewport(prev => {
        const newPanX = prev.panX + vx;
        const newPanY = prev.panY + vy;
        const clamped = clampPan(newPanX, newPanY, prev.zoom);
        return { ...prev, panX: clamped.panX, panY: clamped.panY };
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  }, [isMobile, clampPan]);

  const endPan = useCallback(() => {
    setIsPanning(false);
    if (isMobile) {
      applyInertia();
    }
  }, [isMobile, applyInertia]);

  // Cleanup animation
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const handleWheel = useCallback((e) => {
    if (!containerRef.current) return;
    e.preventDefault();
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = -e.deltaY * 0.001;
    const newZoom = viewport.zoom * (1 + delta);
    
    zoomAt(newZoom, mouseX, mouseY);
  }, [containerRef, viewport.zoom, zoomAt]);

  // Touch handlers для pinch-to-zoom
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      isPinchingRef.current = true;
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
    if (e.touches.length === 2 && isPinchingRef.current) {
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
      
      if (lastTouchDistanceRef.current > 0 && containerRef.current) {
        const scale = distance / lastTouchDistanceRef.current;
        const newZoom = viewport.zoom * scale;
        
        const rect = containerRef.current.getBoundingClientRect();
        
        // Также перемещаем при pinch
        const panDeltaX = center.x - lastTouchCenterRef.current.x;
        const panDeltaY = center.y - lastTouchCenterRef.current.y;
        
        setViewport(prev => {
          const clampedZoom = Math.max(0.2, Math.min(5.0, newZoom));
          
          const centerX = center.x - rect.left;
          const centerY = center.y - rect.top;
          
          const canvasX = (centerX - prev.panX) / prev.zoom;
          const canvasY = (centerY - prev.panY) / prev.zoom;
          
          let newPanX = centerX - canvasX * clampedZoom + panDeltaX;
          let newPanY = centerY - canvasY * clampedZoom + panDeltaY;
          
          const clamped = clampPan(newPanX, newPanY, clampedZoom);
          return { zoom: clampedZoom, panX: clamped.panX, panY: clamped.panY };
        });
      }
      
      lastTouchDistanceRef.current = distance;
      lastTouchCenterRef.current = center;
    }
  }, [containerRef, viewport.zoom, clampPan]);

  const handleTouchEnd = useCallback(() => {
    isPinchingRef.current = false;
    lastTouchDistanceRef.current = 0;
  }, []);

  // Клавиши (пробел)
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

  const screenToCanvas = useCallback((screenX, screenY) => {
    return {
      x: (screenX - viewport.panX) / viewport.zoom,
      y: (screenY - viewport.panY) / viewport.zoom
    };
  }, [viewport]);

  const canvasToScreen = useCallback((canvasX, canvasY) => {
    return {
      x: canvasX * viewport.zoom + viewport.panX,
      y: canvasY * viewport.zoom + viewport.panY
    };
  }, [viewport]);

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
    
    zoomAt,
    zoomTo,
    zoomIn,
    zoomOut,
    fitToView,
    resetZoom,
    
    center,
    startPan,
    pan,
    endPan,
    
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    
    screenToCanvas,
    canvasToScreen,
    getVisibleBounds,
    
    shouldPan: spacePressed || isPanning,
    isPinching: isPinchingRef.current
  };
}

export default useCanvasViewport;