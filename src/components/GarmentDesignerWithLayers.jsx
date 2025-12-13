import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { CANVAS_SIZE, MODEL_PATH, UV_LAYOUT_PATH, TOOLS, PERFORMANCE } from '../utils/constants';
import { createGradientBackground, setupCamera, setupRenderer, setupControls, setupLights, setupGround, disposeScene } from '../utils/sceneSetup';
import { loadModel, positionCamera } from '../utils/modelLoader';
import { getCanvasCoords } from '../utils/drawingUtils';
import { useLayers, LAYER_TYPES } from '../hooks/useLayers';
import { useDrawingWithLayers } from '../hooks/useDrawingWithLayers';
import { useImageTransformWithLayers } from '../hooks/useImageTransformWithLayers';
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

function useUVLayout() {
  const [uvLayoutImage, setUvLayoutImage] = useState(null);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setUvLayoutImage(img);
    img.onerror = () => console.error('Не удалось загрузить UV разметку');
    img.src = UV_LAYOUT_PATH;
  }, []);
  return uvLayoutImage;
}

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
  
  const [tool, setTool] = useState(TOOLS.DRAW);
  const [brushSize, setBrushSize] = useState(15);
  const [brushColor, setBrushColor] = useState('#000000');
  const [loading, setLoading] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [showTools, setShowTools] = useState(true);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  
  const lastPointerTimeRef = useRef(0);
  const textureUpdateScheduledRef = useRef(false);
  const canvasUpdateScheduledRef = useRef(false);
  const layersUpdateRef = useRef(null);
  
  const isMobile = useIsMobile();
  const uvLayoutImage = useUVLayout();

  const scheduleTextureUpdate = useCallback(() => {
    if (textureUpdateScheduledRef.current || !textureRef.current) return;
    textureUpdateScheduledRef.current = true;
    setTimeout(() => {
      if (textureRef.current) textureRef.current.needsUpdate = true;
      textureUpdateScheduledRef.current = false;
    }, PERFORMANCE.TEXTURE_UPDATE_MS);
  }, []);

  const renderUVCanvas = useCallback((layersData, pendingImg, imgTransform) => {
    if (!uvCanvasRef.current) return;
    if (!uvCtxRef.current) uvCtxRef.current = uvCanvasRef.current.getContext('2d', { alpha: false, desynchronized: true });
    const ctx = uvCtxRef.current;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    if (layersData) {
      layersData.forEach(layer => {
        if (layer.visible) {
          ctx.globalAlpha = layer.opacity || 1;
          ctx.drawImage(layer.canvas, 0, 0);
        }
      });
      ctx.globalAlpha = 1;
    }
    
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
    
    if (uvLayoutImage) {
      ctx.globalAlpha = 0.2;
      ctx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.globalAlpha = 1.0;
    }
  }, [uvLayoutImage]);

  const updateUVCanvas = useCallback((force = false, layersData, pendingImg, imgTransform) => {
    if (force) {
      canvasUpdateScheduledRef.current = false;
      renderUVCanvas(layersData, pendingImg, imgTransform);
      if (textureRef.current) textureRef.current.needsUpdate = true;
      return;
    }
    if (canvasUpdateScheduledRef.current) return;
    canvasUpdateScheduledRef.current = true;
    requestAnimationFrame(() => {
      canvasUpdateScheduledRef.current = false;
      renderUVCanvas(layersData, pendingImg, imgTransform);
      scheduleTextureUpdate();
    });
  }, [renderUVCanvas, scheduleTextureUpdate]);

  const {
    layers, activeLayerId, setActiveLayerId, getActiveLayer,
    addDrawingLayer, addImageLayer, toggleLayerVisibility,
    moveLayerUp, moveLayerDown, deleteLayer,
    clearActiveLayer, clearAllLayers, saveToHistory,
    undo, redo, canUndo, canRedo
  } = useLayers((force) => layersUpdateRef.current?.(force));

  const { isDrawing, startDrawing, stopDrawing, drawOnCanvas } = useDrawingWithLayers(
    uvLayoutImage, getActiveLayer, addDrawingLayer, saveToHistory,
    () => layersUpdateRef.current?.()
  );

  const {
    pendingImage, imageTransform, setImageTransform, isTransformMode,
    handleImageUpload, setDesignImageDirect,
    startDrag, drag, stopDrag, applyImage, cancelTransform
  } = useImageTransformWithLayers(uvLayoutImage, addImageLayer, saveToHistory, (force) => layersUpdateRef.current?.(force));

  layersUpdateRef.current = useCallback((force = false) => {
    updateUVCanvas(force, layers, pendingImage, imageTransform);
  }, [updateUVCanvas, layers, pendingImage, imageTransform]);

  useEffect(() => {
    updateUVCanvas(true, layers, pendingImage, imageTransform);
  }, [layers, pendingImage, imageTransform, updateUVCanvas]);

  const handleAIImageGenerated = useCallback((img) => setDesignImageDirect(img), [setDesignImageDirect]);

  useEffect(() => {
    if (!containerRef.current || rendererRef.current) return;
    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = createGradientBackground();
    sceneRef.current = scene;
    const camera = setupCamera(container);
    cameraRef.current = camera;
    const renderer = setupRenderer(container);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    const controls = setupControls(camera, renderer.domElement);
    controlsRef.current = controls;
    setupLights(scene);
    setupGround(scene);
    let lastRenderTime = 0;
    const animate = (time) => {
      animationFrameRef.current = requestAnimationFrame(animate);
      if (time - lastRenderTime < 33) return;
      lastRenderTime = time;
      controls.update();
      renderer.render(scene, camera);
    };
    animate(0);
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      disposeScene(scene, renderer);
      if (container?.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current || modelLoadedRef.current || !uvCanvasRef.current) return;
    modelLoadedRef.current = true;
    setLoading(true);
    loadModel(MODEL_PATH, uvCanvasRef.current,
      (loadedModel, texture) => {
        modelGroupRef.current = loadedModel;
        textureRef.current = texture;
        sceneRef.current.add(loadedModel);
        positionCamera(cameraRef.current, controlsRef.current);
        setLoading(false);
      },
      () => { modelLoadedRef.current = false; setLoading(false); }
    );
  }, []);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    const coords = getCanvasCoords(e, uvCanvasRef.current);
    if (isTransformMode && pendingImage) { startDrag(coords.x, coords.y, e.touches); return; }
    startDrawing();
    drawOnCanvas(coords.x, coords.y, tool, brushColor, brushSize, true);
  }, [isTransformMode, pendingImage, tool, brushColor, brushSize, startDrag, startDrawing, drawOnCanvas]);

  const handlePointerMove = useCallback((e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastPointerTimeRef.current < PERFORMANCE.POINTER_THROTTLE_MS) return;
    lastPointerTimeRef.current = now;
    const coords = getCanvasCoords(e, uvCanvasRef.current);
    if (isTransformMode) { drag(coords.x, coords.y, e.touches); return; }
    drawOnCanvas(coords.x, coords.y, tool, brushColor, brushSize);
  }, [isTransformMode, tool, brushColor, brushSize, drag, drawOnCanvas]);

  const handlePointerUp = useCallback(() => { stopDrawing(); stopDrag(); }, [stopDrawing, stopDrag]);

  const downloadTexture = useCallback(() => {
    if (!uvCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'garment-design.png';
    link.href = uvCanvasRef.current.toDataURL('image/png');
    link.click();
  }, []);

  const toggleWireframe = useCallback(() => {
    if (!modelGroupRef.current) return;
    const nw = !wireframe;
    setWireframe(nw);
    modelGroupRef.current.traverse((c) => { if (c.isMesh && c.material) c.material.wireframe = nw; });
  }, [wireframe]);

  const toolbarProps = useMemo(() => ({
    tool, setTool, brushSize, setBrushSize, brushColor, setBrushColor,
    onImageUpload: handleImageUpload, onAIGenerate: () => setIsAIModalOpen(true),
    onUndo: undo, onRedo: redo, canUndo, canRedo,
    isTransformMode, imageTransform, setImageTransform,
    onApplyImage: applyImage, onCancelImage: cancelTransform, isMobile,
    layers, activeLayerId, onSelectLayer: setActiveLayerId,
    onToggleLayerVisibility: toggleLayerVisibility,
    onMoveLayerUp: moveLayerUp, onMoveLayerDown: moveLayerDown,
    onDeleteLayer: deleteLayer, onAddDrawingLayer: addDrawingLayer,
    onClearLayer: clearActiveLayer, onClearAll: clearAllLayers
  }), [tool, brushSize, brushColor, handleImageUpload, undo, redo, canUndo, canRedo,
    isTransformMode, imageTransform, setImageTransform, applyImage, cancelTransform, isMobile,
    layers, activeLayerId, setActiveLayerId, toggleLayerVisibility, moveLayerUp, moveLayerDown,
    deleteLayer, addDrawingLayer, clearActiveLayer, clearAllLayers]);

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col lg:flex-row overflow-hidden">
      {isMobile && (
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">Дизайнер Одежды</h1>
          <button onClick={() => setShowTools(!showTools)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors">
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5z" /></svg>
                {wireframe ? 'Сплошной' : 'Каркас'}
              </button>
              <button onClick={downloadTexture} className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-all shadow-lg shadow-green-500/30 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Экспорт
              </button>
            </div>
            {loading && <div className="flex items-center gap-2 text-sm text-gray-500"><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />Загрузка...</div>}
          </div>
        </div>
        <div ref={containerRef} className="flex-1 relative touch-none" />
      </main>
      <aside className={`${isMobile ? `fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl transform transition-transform duration-300 ${showTools ? 'translate-y-0' : 'translate-y-full'} z-40 max-h-[70vh] overflow-auto` : 'w-96 bg-white lg:rounded-2xl lg:m-4 lg:ml-0 lg:shadow-xl flex flex-col overflow-hidden'}`}>
        {isMobile && <div className="flex justify-center pt-2 pb-4"><div className="w-12 h-1 bg-gray-300 rounded-full" /></div>}
        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <canvas ref={uvCanvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className={`w-full border-2 border-gray-200 rounded-2xl bg-white shadow-lg touch-none ${isTransformMode ? 'cursor-move' : 'cursor-crosshair'}`}
            onMouseDown={handlePointerDown} onMouseMove={handlePointerMove} onMouseUp={handlePointerUp} onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp} />
        </div>
        <div className="flex-1 overflow-auto"><ToolbarWithLayers {...toolbarProps} /></div>
      </aside>
      <AIGenerationModal isOpen={isAIModalOpen} onClose={() => setIsAIModalOpen(false)} onImageGenerated={handleAIImageGenerated} />
    </div>
  );
}

export default GarmentDesignerWithLayers;