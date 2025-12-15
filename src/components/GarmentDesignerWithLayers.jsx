import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { CANVAS_SIZE, MODEL_PATH, UV_LAYOUT_PATH, TOOLS, PERFORMANCE, BRUSH_HARDNESS } from '../utils/constants';
import { createGradientBackground, setupCamera, setupRenderer, setupControls, setupLights, setupGround, disposeScene, isMobileDevice, setupContextHandlers } from '../utils/sceneSetup';
import { loadModel, positionCamera } from '../utils/modelLoader';
import { getCanvasCoords } from '../utils/drawingUtils';
import { useLayers } from '../hooks/useLayers';
import { useDrawingWithLayers } from '../hooks/useDrawingWithLayers';
import { useImageTransformWithLayers } from '../hooks/useImageTransformWithLayers';
import { createCmykPdf } from '../services/cmykExportService';
import ToolbarWithLayers from './ToolbarWithLayers';
import AIGenerationModal from './AIGenerationModal';

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
  const uvCtxRef = useRef(null);
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
  const [brushHardness, setBrushHardness] = useState(BRUSH_HARDNESS.DEFAULT);
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

  const renderUVCanvas = useCallback(() => {
    if (!uvCanvasRef.current) return;
    if (!uvCtxRef.current) {
      uvCtxRef.current = uvCanvasRef.current.getContext('2d', { alpha: false });
    }
    const ctx = uvCtxRef.current;
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
    
    const pendingImg = pendingImageRef.current;
    const imgTransform = imageTransformRef.current;
    if (pendingImg && imgTransform) {
      const imgW = CANVAS_SIZE * imgTransform.scale;
      const imgH = CANVAS_SIZE * imgTransform.scale;
      const centerX = CANVAS_SIZE / 2 + imgTransform.x;
      const centerY = CANVAS_SIZE / 2 + imgTransform.y;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(imgTransform.rotation * Math.PI / 180);
      ctx.drawImage(pendingImg, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.restore();
    }
    
    const uvLayoutImage = uvLayoutImageRef.current;
    if (uvLayoutImage) {
      ctx.globalAlpha = 0.2;
      ctx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.globalAlpha = 1.0;
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

  const {
    layers, activeLayerId, setActiveLayerId, getActiveLayer,
    addDrawingLayer, addImageLayer, toggleLayerVisibility,
    moveLayerUp, moveLayerDown, deleteLayer,
    clearActiveLayer, clearAllLayers, saveToHistory,
    undo, redo, canUndo, canRedo
  } = useLayers(updateCanvas);

  useEffect(() => { layersRef.current = layers; renderUVCanvas(); }, [layers, renderUVCanvas]);

  const { isDrawing, startDrawing, stopDrawing, drawOnCanvas } = useDrawingWithLayers(
    uvLayoutImage, getActiveLayer, addDrawingLayer, saveToHistory, updateCanvas
  );

  const {
    pendingImage, imageTransform, setImageTransform, isTransformMode,
    handleImageUpload, setDesignImageDirect, startDrag, drag, stopDrag,
    applyImage, cancelTransform
  } = useImageTransformWithLayers(uvLayoutImage, addImageLayer, saveToHistory, updateCanvas);

  useEffect(() => {
    pendingImageRef.current = pendingImage;
    imageTransformRef.current = imageTransform;
    renderUVCanvas();
  }, [pendingImage, imageTransform, renderUVCanvas]);

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
      (error) => { modelLoadedRef.current = false; setLoading(false); setWebglError('Не удалось загрузить модель'); }
    );
  }, [renderUVCanvas]);

  // Обработчики pointer
  const handlePointerDown = useCallback((e) => {
    const coords = getCanvasCoords(e, uvCanvasRef.current);
    if (isTransformMode && pendingImage) {
      startDrag(coords.x, coords.y, e.touches);
      return;
    }
    startDrawing(tool);
    drawOnCanvas(coords.x, coords.y, tool, brushColor, brushSize, true, brushHardness);
  }, [isTransformMode, pendingImage, tool, brushColor, brushSize, brushHardness, startDrag, startDrawing, drawOnCanvas]);

  const handlePointerMove = useCallback((e) => {
    const now = Date.now();
    if (now - lastPointerTimeRef.current < PERFORMANCE.POINTER_THROTTLE_MS) return;
    lastPointerTimeRef.current = now;
    const coords = getCanvasCoords(e, uvCanvasRef.current);
    if (isTransformMode) { drag(coords.x, coords.y, e.touches); return; }
    drawOnCanvas(coords.x, coords.y, tool, brushColor, brushSize, false, brushHardness);
  }, [isTransformMode, tool, brushColor, brushSize, brushHardness, drag, drawOnCanvas]);

  const handlePointerUp = useCallback(() => { stopDrawing(); stopDrag(); }, [stopDrawing, stopDrag]);

  // Экспорт PNG (RGB)
  const downloadTexturePng = useCallback(() => {
    if (!uvCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'garment-design.png';
    link.href = uvCanvasRef.current.toDataURL('image/png');
    link.click();
  }, []);

  // Экспорт PDF (CMYK)
  const downloadTextureCmykPdf = useCallback(async () => {
    if (!uvCanvasRef.current || exportingPdf) return;
    setExportingPdf(true);
    try {
      await createCmykPdf(uvCanvasRef.current, 'garment-design-cmyk.pdf');
    } catch (err) {
      console.error('PDF export error:', err);
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

  const toolbarProps = useMemo(() => ({
    tool, setTool, brushSize, setBrushSize, brushColor, setBrushColor,
    brushHardness, setBrushHardness,
    onImageUpload: handleImageUpload, onAIGenerate: () => setIsAIModalOpen(true),
    onUndo: undo, onRedo: redo, canUndo, canRedo,
    isTransformMode, imageTransform, setImageTransform,
    onApplyImage: applyImage, onCancelImage: cancelTransform, isMobile,
    layers, activeLayerId, onSelectLayer: setActiveLayerId,
    onToggleLayerVisibility: toggleLayerVisibility,
    onMoveLayerUp: moveLayerUp, onMoveLayerDown: moveLayerDown,
    onDeleteLayer: deleteLayer, onAddDrawingLayer: addDrawingLayer,
    onClearLayer: clearActiveLayer, onClearAll: clearAllLayers
  }), [tool, brushSize, brushColor, brushHardness, handleImageUpload, undo, redo, canUndo, canRedo,
    isTransformMode, imageTransform, setImageTransform, applyImage, cancelTransform, isMobile,
    layers, activeLayerId, setActiveLayerId, toggleLayerVisibility, moveLayerUp, moveLayerDown,
    deleteLayer, addDrawingLayer, clearActiveLayer, clearAllLayers]);

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col lg:flex-row overflow-hidden">
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
      
      <main className="flex-1 flex flex-col bg-white lg:rounded-2xl lg:m-4 lg:shadow-xl overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button onClick={toggleWireframe} disabled={loading} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${wireframe ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} disabled:opacity-50`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5z" />
                </svg>
                {wireframe ? 'Сплошной' : 'Каркас'}
              </button>
              
              {/* Кнопка PNG */}
              <button onClick={downloadTexturePng} className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-500/30 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PNG (RGB)
              </button>
              
              {/* Кнопка CMYK PDF */}
              <button onClick={downloadTextureCmykPdf} disabled={exportingPdf} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/30 flex items-center gap-2 disabled:opacity-50">
                {exportingPdf ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                PDF (CMYK)
              </button>
            </div>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Загрузка...
              </div>
            )}
          </div>
        </div>
        
        <div ref={containerRef} className="flex-1 relative" style={{ touchAction: 'none' }}>
          {webglError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
              <div className="bg-white rounded-xl p-6 m-4 max-w-sm text-center">
                <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ошибка 3D</h3>
                <p className="text-sm text-gray-600 mb-4">{webglError}</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium">
                  Перезагрузить
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
      
      <aside className={`${isMobile ? `fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl transform transition-transform duration-300 ${showTools ? 'translate-y-0' : 'translate-y-full'} z-40 max-h-[70vh] overflow-auto` : 'w-96 bg-white lg:rounded-2xl lg:m-4 lg:ml-0 lg:shadow-xl flex flex-col overflow-hidden'}`}>
        {isMobile && <div className="flex justify-center pt-2 pb-4"><div className="w-12 h-1 bg-gray-300 rounded-full" /></div>}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <canvas ref={uvCanvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE}
            className={`w-full border-2 border-gray-200 rounded-2xl bg-white shadow-lg ${isTransformMode ? 'cursor-move' : 'cursor-crosshair'}`}
            style={{ touchAction: 'none' }}
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
          />
        </div>
        <div className="flex-1 overflow-auto">
          <ToolbarWithLayers {...toolbarProps} />
        </div>
      </aside>
      
      <AIGenerationModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onImageGenerated={handleAIImageGenerated} />
    </div>
  );
}

export default GarmentDesignerWithLayers;