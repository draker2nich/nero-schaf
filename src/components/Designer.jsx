import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { CANVAS_SIZE, MODEL_PATH, UV_LAYOUT_PATH, TOOLS, PERFORMANCE, BRUSH_OPACITY } from '../utils/constants';
import { createGradientBackground, setupCamera, setupRenderer, setupControls, setupLights, setupGround, disposeScene, isMobileDevice, setupContextHandlers } from '../utils/sceneSetup';
import { loadModel, positionCamera } from '../utils/modelLoader';
import { useLayers } from '../hooks/useLayers';
import { useDrawingWithTools } from '../hooks/useDrawing';
import { useImageTransformWithLayers } from '../hooks/useImage';
import { useCanvasViewport } from '../hooks/useCanvas';
import { createCmykPdf } from '../services/cmykExport';
import ToolbarWithLayers from './Toolbar';
import AIGenerationModal from './AI';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    let tid;
    const debounced = () => { clearTimeout(tid); tid = setTimeout(check, 150); };
    window.addEventListener('resize', debounced);
    return () => { window.removeEventListener('resize', debounced); clearTimeout(tid); };
  }, []);
  return isMobile;
}

function useUVLayout(onLoad) {
  const [uvLayoutImage, setUvLayoutImage] = useState(null);
  const onLoadRef = useRef(onLoad);
  useEffect(() => { onLoadRef.current = onLoad; }, [onLoad]);
  useEffect(() => {
    const img = new Image();
    img.onload = () => { setUvLayoutImage(img); if (onLoadRef.current) onLoadRef.current(); };
    img.onerror = () => console.error('Не удалось загрузить UV разметку');
    img.src = UV_LAYOUT_PATH;
  }, []);
  return uvLayoutImage;
}

let globalSceneInitialized = false;

function GarmentDesignerWithLayers() {
  const containerRef = useRef(null);
  const uvCanvasRef = useRef(null);
  const uvCanvasContainerRef = useRef(null);
  const uvCtxRef = useRef(null);
  const compositeCanvasRef = useRef(null);
  
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const textureRef = useRef(null);
  const modelGroupRef = useRef(null);
  const animationFrameRef = useRef(null);
  const modelLoadedRef = useRef(false);
  const mountedRef = useRef(false);
  
  const [tool, setTool] = useState(TOOLS.DRAW);
  const [brushSize, setBrushSize] = useState(15);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushHardness, setBrushHardness] = useState(80);
  const [brushOpacity, setBrushOpacity] = useState(BRUSH_OPACITY.DEFAULT);
  const [loading, setLoading] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [showTools, setShowTools] = useState(true);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [webglError, setWebglError] = useState(null);
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  
  const lastPointerTimeRef = useRef(0);
  const layersRef = useRef([]);
  const pendingImageRef = useRef(null);
  const imageTransformRef = useRef({ x: 0, y: 0, scale: 1, rotation: 0 });
  const uvLayoutImageRef = useRef(null);
  
  const isMobile = useIsMobile();
  const isMobileDeviceRef = useRef(isMobileDevice());

  // Viewport для зума и панорамирования
  const {
    viewport,
    isPanning,
    spacePressed,
    shouldPan,
    isInitialized: viewportInitialized,
    zoomIn,
    zoomOut,
    fitToView,
    resetZoom,
    startPan,
    pan,
    endPan,
    handleWheel,
    screenToCanvas,
    canvasToScreen,
    getVisibleBounds
  } = useCanvasViewport(uvCanvasContainerRef);

  // Рендеринг UV canvas с учётом слоёв
  const renderUVCanvas = useCallback(() => {
    if (!uvCanvasRef.current) return;
    if (!uvCtxRef.current) {
      uvCtxRef.current = uvCanvasRef.current.getContext('2d', { alpha: false });
    }
    const ctx = uvCtxRef.current;
    
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    const currentLayers = layersRef.current;
    if (currentLayers && currentLayers.length > 0) {
      currentLayers.forEach(layer => {
        if (layer.visible && layer.canvas) {
          ctx.globalAlpha = layer.opacity || 1;
          ctx.drawImage(layer.canvas, 0, 0);
        }
      });
      ctx.globalAlpha = 1;
    }
    
    // Рендеринг pending изображения
    const pendingImg = pendingImageRef.current;
    const imgTransform = imageTransformRef.current;
    if (pendingImg && imgTransform) {
      const originalWidth = pendingImg.naturalWidth || pendingImg.width;
      const originalHeight = pendingImg.naturalHeight || pendingImg.height;
      
      const imgW = CANVAS_SIZE * imgTransform.scale;
      const imgH = CANVAS_SIZE * imgTransform.scale * (originalHeight / originalWidth);
      
      const centerX = CANVAS_SIZE / 2 + imgTransform.x;
      const centerY = CANVAS_SIZE / 2 + imgTransform.y;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(imgTransform.rotation * Math.PI / 180);
      ctx.drawImage(pendingImg, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.restore();
    }
    
    // UV разметка
    const uvLayoutImage = uvLayoutImageRef.current;
    if (uvLayoutImage) {
      ctx.globalAlpha = 0.2;
      ctx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.globalAlpha = 1.0;
    }
    
    // Обновляем composite canvas для штампа
    if (compositeCanvasRef.current) {
      const compositeCtx = compositeCanvasRef.current.getContext('2d');
      compositeCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      compositeCtx.drawImage(uvCanvasRef.current, 0, 0);
    }
    
    if (textureRef.current) textureRef.current.needsUpdate = true;
  }, []);

  const handleUVLayoutLoaded = useCallback(() => { renderUVCanvas(); }, [renderUVCanvas]);
  const uvLayoutImage = useUVLayout(handleUVLayoutLoaded);
  
  useEffect(() => {
    uvLayoutImageRef.current = uvLayoutImage;
    if (uvLayoutImage) renderUVCanvas();
  }, [uvLayoutImage, renderUVCanvas]);

  const updateCanvas = useCallback((force = false) => {
    renderUVCanvas();
    if (textureRef.current) textureRef.current.needsUpdate = true;
    if (force) setUpdateTrigger(prev => prev + 1);
  }, [renderUVCanvas]);

  // Хук слоёв
  const {
    layers, activeLayerId, setActiveLayerId, getActiveLayer,
    addDrawingLayer, addImageLayer, toggleLayerVisibility,
    moveLayerUp, moveLayerDown, deleteLayer,
    clearActiveLayer, clearAllLayers, saveToHistory,
    undo, redo, canUndo, canRedo
  } = useLayers(updateCanvas);

  useEffect(() => { layersRef.current = layers; renderUVCanvas(); }, [layers, renderUVCanvas]);

  // Хук рисования
  const {
    isDrawing,
    currentTool,
    stampSourceSet,
    selectTool,
    setStampSource,
    needsStampSource,
    getStampSourcePoint,
    startDrawing,
    continueDrawing,
    stopDrawing,
    cancelDrawing
  } = useDrawingWithTools(
    uvLayoutImage,
    getActiveLayer,
    addDrawingLayer,
    saveToHistory,
    updateCanvas,
    viewport,
    screenToCanvas,
    () => compositeCanvasRef.current
  );

  // Хук трансформации изображения
  const {
    pendingImage, imageTransform, setImageTransform, isTransformMode,
    qualityInfo,
    handleImageUpload, setDesignImageDirect, startDrag, drag, stopDrag,
    applyImage, cancelTransform
  } = useImageTransformWithLayers(uvLayoutImage, addImageLayer, saveToHistory, updateCanvas);

  useEffect(() => {
    pendingImageRef.current = pendingImage;
    imageTransformRef.current = imageTransform;
    renderUVCanvas();
  }, [pendingImage, imageTransform, renderUVCanvas]);

  // Синхронизация инструмента
  useEffect(() => {
    selectTool(tool);
  }, [tool, selectTool]);

  const handleAIImageGenerated = useCallback((img) => { setDesignImageDirect(img); }, [setDesignImageDirect]);

  // Инициализация Three.js
  useEffect(() => {
    if (!containerRef.current || globalSceneInitialized || rendererRef.current) return;
    mountedRef.current = true;
    globalSceneInitialized = true;
    
    const container = containerRef.current;
    const isMobileFlag = isMobileDeviceRef.current;
    
    const scene = new THREE.Scene();
    scene.background = createGradientBackground();
    sceneRef.current = scene;
    
    const camera = setupCamera(container);
    cameraRef.current = camera;
    
    const renderer = setupRenderer(container);
    if (!renderer) {
      setWebglError('WebGL не поддерживается');
      globalSceneInitialized = false;
      return;
    }
    
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    setupContextHandlers(renderer, 
      () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); setWebglError('WebGL контекст потерян'); },
      () => { setWebglError(null); if (mountedRef.current) animate(); }
    );
    
    const controls = setupControls(camera, renderer.domElement);
    controlsRef.current = controls;
    
    setupLights(scene, isMobileFlag);
    setupGround(scene, isMobileFlag);
    
    const animate = () => {
      if (!mountedRef.current) return;
      animationFrameRef.current = requestAnimationFrame(animate);
      try {
        const gl = renderer.getContext();
        if (gl && gl.isContextLost()) return;
        controls.update();
        renderer.render(scene, camera);
      } catch (e) { console.error('[Render error]:', e); }
    };
    animate();
    
    const handleResize = () => {
      if (!container || !renderer || !mountedRef.current) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    
    return () => {
      mountedRef.current = false;
      globalSceneInitialized = false;
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (sceneRef.current && rendererRef.current) disposeScene(sceneRef.current, rendererRef.current);
      if (container && rendererRef.current?.domElement) try { container.removeChild(rendererRef.current.domElement); } catch {}
      rendererRef.current = null;
    };
  }, []);

  // Загрузка модели
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current || !uvCanvasRef.current || modelLoadedRef.current) return;
    modelLoadedRef.current = true;
    setLoading(true);
    
    loadModel(MODEL_PATH, uvCanvasRef.current,
      (loadedModel, texture) => {
        if (!mountedRef.current || !sceneRef.current) return;
        modelGroupRef.current = loadedModel;
        textureRef.current = texture;
        sceneRef.current.add(loadedModel);
        positionCamera(cameraRef.current, controlsRef.current);
        setLoading(false);
        renderUVCanvas();
      },
      () => { modelLoadedRef.current = false; setLoading(false); setWebglError('Не удалось загрузить модель'); }
    );
  }, [renderUVCanvas]);

  // Инициализация composite canvas
  useEffect(() => {
    if (!compositeCanvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      compositeCanvasRef.current = canvas;
    }
  }, []);

  // Получение координат на canvas с учётом viewport
  const getCanvasCoords = useCallback((e) => {
    if (!uvCanvasContainerRef.current) return { x: 0, y: 0 };
    
    const rect = uvCanvasContainerRef.current.getBoundingClientRect();
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    const clientX = touch ? touch.clientX : e.clientX;
    const clientY = touch ? touch.clientY : e.clientY;
    
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    
    return screenToCanvas(screenX, screenY);
  }, [screenToCanvas]);

  // Обработчики pointer событий
  const handlePointerDown = useCallback((e) => {
    const rect = uvCanvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Панорамирование
    if (shouldPan || e.button === 1) {
      e.preventDefault();
      startPan(e.clientX, e.clientY);
      return;
    }

    // Alt+Click для штампа
    if (tool === TOOLS.STAMP && e.altKey) {
      const coords = getCanvasCoords(e);
      // Проверяем границы холста
      if (coords.x >= 0 && coords.x < CANVAS_SIZE && coords.y >= 0 && coords.y < CANVAS_SIZE) {
        setStampSource(coords.x, coords.y, compositeCanvasRef.current);
      }
      return;
    }

    // Трансформация изображения
    if (isTransformMode && pendingImage) {
      const coords = getCanvasCoords(e);
      startDrag(coords.x, coords.y, e.touches);
      return;
    }

    // Рисование
    const settings = {
      brushSize,
      brushColor,
      brushHardness,
      brushOpacity
    };
    startDrawing(e, rect, settings, compositeCanvasRef.current);
  }, [shouldPan, tool, isTransformMode, pendingImage, brushSize, brushColor, brushHardness, brushOpacity, startPan, getCanvasCoords, setStampSource, startDrag, startDrawing]);

  const handlePointerMove = useCallback((e) => {
    const now = Date.now();
    if (now - lastPointerTimeRef.current < PERFORMANCE.POINTER_THROTTLE_MS) return;
    lastPointerTimeRef.current = now;

    const rect = uvCanvasContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Панорамирование
    if (isPanning) {
      pan(e.clientX, e.clientY);
      return;
    }

    // Трансформация
    if (isTransformMode) {
      const coords = getCanvasCoords(e);
      drag(coords.x, coords.y, e.touches);
      return;
    }

    // Рисование
    const settings = {
      brushSize,
      brushColor,
      brushHardness,
      brushOpacity
    };
    continueDrawing(e, rect, settings, compositeCanvasRef.current);
  }, [isPanning, isTransformMode, brushSize, brushColor, brushHardness, brushOpacity, getCanvasCoords, pan, drag, continueDrawing]);

  const handlePointerUp = useCallback((e) => {
    if (isPanning) {
      endPan();
      return;
    }
    stopDrawing(e, uvCanvasContainerRef.current?.getBoundingClientRect());
    stopDrag();
  }, [isPanning, endPan, stopDrawing, stopDrag]);

  const handlePointerLeave = useCallback(() => {
    if (isPanning) endPan();
    stopDrawing();
    stopDrag();
  }, [isPanning, endPan, stopDrawing, stopDrag]);

  // Экспорт
  const downloadTexturePng = useCallback(() => {
    if (!uvCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'garment-design.png';
    link.href = uvCanvasRef.current.toDataURL('image/png');
    link.click();
  }, []);

  const downloadTextureCmykPdf = useCallback(async () => {
    if (!uvCanvasRef.current || exportingPdf) return;
    setExportingPdf(true);
    try {
      await createCmykPdf(uvCanvasRef.current, 'garment-design-cmyk.pdf');
    } catch (err) {
      alert('Ошибка экспорта PDF: ' + err.message);
    } finally {
      setExportingPdf(false);
    }
  }, [exportingPdf]);

  const toggleWireframe = useCallback(() => {
    if (!modelGroupRef.current) return;
    const nw = !wireframe;
    setWireframe(nw);
    modelGroupRef.current.traverse((c) => { if (c.isMesh && c.material) c.material.wireframe = nw; });
  }, [wireframe]);

  // Определяем курсор
  const getCursor = useCallback(() => {
    if (shouldPan) return isPanning ? 'grabbing' : 'grab';
    if (tool === TOOLS.STAMP && needsStampSource()) return 'crosshair';
    return 'crosshair';
  }, [shouldPan, isPanning, tool, needsStampSource]);

  // Стиль canvas контейнера с учётом viewport
  const canvasContainerStyle = useMemo(() => ({
    width: CANVAS_SIZE * viewport.zoom,
    height: CANVAS_SIZE * viewport.zoom,
    transform: `translate(${viewport.panX}px, ${viewport.panY}px)`,
    transformOrigin: '0 0',
    position: 'absolute',
    top: 0,
    left: 0
  }), [viewport]);

  // Props для тулбара
  const toolbarProps = useMemo(() => ({
    tool, setTool, brushSize, setBrushSize, brushColor, setBrushColor,
    brushHardness, setBrushHardness, brushOpacity, setBrushOpacity,
    onImageUpload: handleImageUpload, onAIGenerate: () => setIsAIModalOpen(true),
    onUndo: undo, onRedo: redo, canUndo, canRedo,
    isTransformMode, imageTransform, setImageTransform,
    onApplyImage: applyImage, onCancelImage: cancelTransform, isMobile,
    qualityInfo,
    layers, activeLayerId, onSelectLayer: setActiveLayerId,
    onToggleLayerVisibility: toggleLayerVisibility,
    onMoveLayerUp: moveLayerUp, onMoveLayerDown: moveLayerDown,
    onDeleteLayer: deleteLayer, onAddDrawingLayer: addDrawingLayer,
    onClearLayer: clearActiveLayer, onClearAll: clearAllLayers,
    viewport, onZoomIn: zoomIn, onZoomOut: zoomOut, onFitToView: fitToView, onResetZoom: resetZoom,
    stampSourceSet, stampSourcePoint: getStampSourcePoint()
  }), [tool, brushSize, brushColor, brushHardness, brushOpacity, handleImageUpload, undo, redo, canUndo, canRedo,
    isTransformMode, imageTransform, setImageTransform, applyImage, cancelTransform, isMobile,
    qualityInfo, layers, activeLayerId, setActiveLayerId, toggleLayerVisibility, moveLayerUp, moveLayerDown,
    deleteLayer, addDrawingLayer, clearActiveLayer, clearAllLayers,
    viewport, zoomIn, zoomOut, fitToView, resetZoom, stampSourceSet, getStampSourcePoint]);

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col lg:flex-row overflow-hidden">
      {/* Mobile Header */}
      {isMobile && (
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">Дизайнер Одежды</h1>
          <button onClick={() => setShowTools(!showTools)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>
      )}
      
      {/* 3D Preview */}
      <main className="flex-1 flex flex-col bg-white lg:rounded-2xl lg:m-4 lg:shadow-xl overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={toggleWireframe} disabled={loading} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${wireframe ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} disabled:opacity-50`}>
                {wireframe ? 'Сплошной' : 'Каркас'}
              </button>
              <button onClick={downloadTexturePng} className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600">
                PNG
              </button>
              <button onClick={downloadTextureCmykPdf} disabled={exportingPdf} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50">
                {exportingPdf ? '...' : 'PDF (CMYK)'}
              </button>
            </div>
            {loading && <div className="text-sm text-gray-500">Загрузка...</div>}
          </div>
        </div>
        
        <div ref={containerRef} className="flex-1 relative" style={{ touchAction: 'none' }}>
          {webglError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
              <div className="bg-white rounded-xl p-6 m-4 max-w-sm text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ошибка 3D</h3>
                <p className="text-sm text-gray-600 mb-4">{webglError}</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-500 text-white rounded-lg">Перезагрузить</button>
              </div>
            </div>
          )}
        </div>
      </main>
      
      {/* Sidebar with Canvas */}
      <aside className={`${isMobile ? `fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl transform transition-transform duration-300 ${showTools ? 'translate-y-0' : 'translate-y-full'} z-40 max-h-[70vh] overflow-auto` : 'w-96 bg-white lg:rounded-2xl lg:m-4 lg:ml-0 lg:shadow-xl flex flex-col overflow-hidden'}`}>
        {isMobile && <div className="flex justify-center pt-2 pb-4"><div className="w-12 h-1 bg-gray-300 rounded-full" /></div>}
        
        {/* Canvas Container с зумом */}
        <div 
          ref={uvCanvasContainerRef}
          className="p-4 border-b border-gray-200 flex-shrink-0 relative bg-gray-100"
          style={{ 
            minHeight: 320,
            overflow: 'hidden',
            cursor: getCursor()
          }}
          onWheel={handleWheel}
        >
          {/* Индикатор границ области */}
          <div className="absolute inset-4 border-2 border-dashed border-gray-300 rounded-lg pointer-events-none" />
          
          <div 
            className="relative"
            style={canvasContainerStyle}
          >
            <canvas 
              ref={uvCanvasRef} 
              width={CANVAS_SIZE} 
              height={CANVAS_SIZE}
              className="w-full h-full border-2 border-gray-300 rounded-lg bg-white shadow-lg"
              style={{ 
                touchAction: 'none',
                imageRendering: viewport.zoom > 2 ? 'pixelated' : 'auto'
              }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerLeave}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          </div>
          
          {/* Индикатор зума */}
          <div className="absolute bottom-6 right-6 px-2 py-1 bg-black/60 text-white text-xs rounded-md font-mono">
            {Math.round(viewport.zoom * 100)}%
          </div>
          
          {/* Подсказка для штампа */}
          {tool === TOOLS.STAMP && needsStampSource() && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-yellow-100 border border-yellow-300 rounded-lg text-xs text-yellow-800 shadow-md">
              Alt+Click для выбора источника
            </div>
          )}
          
          {/* Подсказка про пробел */}
          {!isMobile && (
            <div className="absolute top-6 left-6 px-2 py-1 bg-black/40 text-white text-[10px] rounded-md">
              Пробел + перетаскивание
            </div>
          )}
        </div>
        
        {/* Toolbar */}
        <div className="flex-1 overflow-auto">
          <ToolbarWithLayers {...toolbarProps} />
        </div>
      </aside>
      
      {/* AI Modal */}
      <AIGenerationModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onImageGenerated={handleAIImageGenerated} />
    </div>
  );
}

export default GarmentDesignerWithLayers;