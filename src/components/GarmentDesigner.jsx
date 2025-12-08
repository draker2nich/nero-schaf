import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { 
  CANVAS_SIZE, 
  MODEL_PATH, 
  UV_LAYOUT_PATH, 
  TOOLS,
  PERFORMANCE
} from '../utils/constants';
import { 
  createGradientBackground,
  setupCamera,
  setupRenderer,
  setupControls,
  setupLights,
  setupGround,
  disposeScene
} from '../utils/sceneSetup';
import { loadModel, positionCamera } from '../utils/modelLoader';
import { getCanvasCoords } from '../utils/drawingUtils';
import { useDrawing } from '../hooks/useDrawing';
import { useImageTransform } from '../hooks/useImageTransform';
import Toolbar from './Toolbar';

// Хук для определения мобильного устройства
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    
    let timeoutId;
    const debouncedCheck = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(check, 150);
    };
    
    window.addEventListener('resize', debouncedCheck);
    return () => {
      window.removeEventListener('resize', debouncedCheck);
      clearTimeout(timeoutId);
    };
  }, []);
  
  return isMobile;
}

// Хук для загрузки UV layout
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

export default function GarmentDesigner() {
  const containerRef = useRef(null);
  const uvCanvasRef = useRef(null);
  const uvCtxRef = useRef(null);
  
  // Three.js refs
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const textureRef = useRef(null);
  const modelGroupRef = useRef(null);
  const animationFrameRef = useRef(null);
  const modelLoadedRef = useRef(false);
  
  // Состояния
  const [tool, setTool] = useState(TOOLS.DRAW);
  const [brushSize, setBrushSize] = useState(15);
  const [brushColor, setBrushColor] = useState('#000000');
  const [loading, setLoading] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [showTools, setShowTools] = useState(true);
  
  // Refs для throttling
  const lastPointerTimeRef = useRef(0);
  const textureUpdateScheduledRef = useRef(false);
  const canvasUpdateScheduledRef = useRef(false);
  
  const isMobile = useIsMobile();
  const uvLayoutImage = useUVLayout();

  // Refs для изображения (чтобы избежать лишних ререндеров)
  const designImageRef = useRef(null);
  const imageTransformRef = useRef({ x: 0, y: 0, scale: 1, rotation: 0 });

  // ИСПРАВЛЕНО: Принудительное обновление 3D текстуры
  const forceTextureUpdate = useCallback(() => {
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
  }, []);

  // Обновление 3D текстуры с throttle
  const scheduleTextureUpdate = useCallback(() => {
    if (textureUpdateScheduledRef.current || !textureRef.current) return;
    
    textureUpdateScheduledRef.current = true;
    setTimeout(() => {
      if (textureRef.current) {
        textureRef.current.needsUpdate = true;
      }
      textureUpdateScheduledRef.current = false;
    }, PERFORMANCE.TEXTURE_UPDATE_MS);
  }, []);

  // Отрисовка UV canvas
  const renderUVCanvas = useCallback(() => {
    if (!uvCanvasRef.current) return;
    
    if (!uvCtxRef.current) {
      uvCtxRef.current = uvCanvasRef.current.getContext('2d', {
        alpha: false,
        desynchronized: true
      });
    }
    
    const ctx = uvCtxRef.current;
    
    // Белый фон
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // Слой рисования
    if (drawingLayerRef.current) {
      ctx.drawImage(drawingLayerRef.current, 0, 0);
    }
    
    // Изображение в режиме трансформации
    const img = designImageRef.current;
    const transform = imageTransformRef.current;
    
    if (img) {
      const imgW = CANVAS_SIZE * transform.scale;
      const imgH = CANVAS_SIZE * transform.scale;
      const centerX = CANVAS_SIZE / 2 + transform.x;
      const centerY = CANVAS_SIZE / 2 + transform.y;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(transform.rotation * Math.PI / 180);
      ctx.drawImage(img, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.restore();
    }
    
    // UV разметка
    if (uvLayoutImage) {
      ctx.globalAlpha = 0.2;
      ctx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.globalAlpha = 1.0;
    }
  }, [uvLayoutImage]);

  // ИСПРАВЛЕНО: Обновление canvas с поддержкой принудительного режима
  const updateUVCanvas = useCallback((force = false) => {
    if (force) {
      canvasUpdateScheduledRef.current = false;
      renderUVCanvas();
      // Синхронное обновление текстуры
      if (textureRef.current) {
        textureRef.current.needsUpdate = true;
      }
      return;
    }
    
    // Обычное обновление с throttling
    if (canvasUpdateScheduledRef.current) return;
    
    canvasUpdateScheduledRef.current = true;
    requestAnimationFrame(() => {
      canvasUpdateScheduledRef.current = false;
      renderUVCanvas();
      scheduleTextureUpdate();
    });
  }, [renderUVCanvas]);

  // Хук рисования
  const {
    drawingLayerRef,
    startDrawing,
    stopDrawing,
    drawOnCanvas,
    undo,
    redo,
    clearCanvas,
    saveToHistory,
    canUndo,
    canRedo
  } = useDrawing(uvLayoutImage, updateUVCanvas);

  // Хук трансформации
  const {
    designImage,
    imageTransform,
    setImageTransform,
    isTransformMode,
    handleImageUpload,
    startDrag,
    drag,
    stopDrag,
    applyImage,
    cancelTransform,
    resetImageState // Новый метод
  } = useImageTransform(drawingLayerRef, uvLayoutImage, saveToHistory, updateUVCanvas);

  // ИСПРАВЛЕНО: Обёртка для clearCanvas с сбросом изображения
  const handleClearCanvas = useCallback(() => {
    clearCanvas(() => {
      // Сбрасываем состояние изображения при очистке
      resetImageState();
      // Очищаем refs
      designImageRef.current = null;
      imageTransformRef.current = { x: 0, y: 0, scale: 1, rotation: 0 };
    });
  }, [clearCanvas, resetImageState]);

  // Синхронизация refs
  useEffect(() => {
    designImageRef.current = designImage;
    updateUVCanvas();
  }, [designImage, updateUVCanvas]);

  useEffect(() => {
    imageTransformRef.current = imageTransform;
    updateUVCanvas();
  }, [imageTransform, updateUVCanvas]);

  // Three.js сцена
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

    // Оптимизированный рендер цикл
    let lastRenderTime = 0;
    const animate = (time) => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      // Ограничение до 30fps для экономии ресурсов
      if (time - lastRenderTime < 33) return;
      lastRenderTime = time;
      
      controls.update();
      renderer.render(scene, camera);
    };
    animate(0);

    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      disposeScene(scene, renderer);
      if (container?.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
    };
  }, []);

  // Загрузка модели
  useEffect(() => {
    if (!sceneRef.current || modelLoadedRef.current || !uvCanvasRef.current) return;
    
    modelLoadedRef.current = true;
    setLoading(true);
    
    loadModel(
      MODEL_PATH,
      uvCanvasRef.current,
      (loadedModel, texture) => {
        modelGroupRef.current = loadedModel;
        textureRef.current = texture;
        
        sceneRef.current.add(loadedModel);
        positionCamera(cameraRef.current, controlsRef.current);
        
        setLoading(false);
      },
      () => {
        modelLoadedRef.current = false;
        setLoading(false);
      }
    );
  }, []);

  // Обработчики pointer событий с throttling
  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    
    const coords = getCanvasCoords(e, uvCanvasRef.current);

    if (isTransformMode && designImage) {
      startDrag(coords.x, coords.y, e.touches);
      return;
    }

    startDrawing();
    drawOnCanvas(coords.x, coords.y, tool, brushColor, brushSize, true);
  }, [isTransformMode, designImage, tool, brushColor, brushSize, startDrag, startDrawing, drawOnCanvas]);

  const handlePointerMove = useCallback((e) => {
    e.preventDefault();
    
    // Throttle pointer events
    const now = Date.now();
    if (now - lastPointerTimeRef.current < PERFORMANCE.POINTER_THROTTLE_MS) {
      return;
    }
    lastPointerTimeRef.current = now;
    
    const coords = getCanvasCoords(e, uvCanvasRef.current);
    
    if (isTransformMode) {
      drag(coords.x, coords.y, e.touches);
      return;
    }

    drawOnCanvas(coords.x, coords.y, tool, brushColor, brushSize);
  }, [isTransformMode, tool, brushColor, brushSize, drag, drawOnCanvas]);

  const handlePointerUp = useCallback(() => {
    stopDrawing();
    stopDrag();
  }, [stopDrawing, stopDrag]);

  const downloadTexture = useCallback(() => {
    if (!uvCanvasRef.current) return;
    
    const link = document.createElement('a');
    link.download = 'garment-design.png';
    link.href = uvCanvasRef.current.toDataURL('image/png');
    link.click();
  }, []);

  const toggleWireframe = useCallback(() => {
    if (!modelGroupRef.current) return;
    
    const newWireframe = !wireframe;
    setWireframe(newWireframe);
    
    modelGroupRef.current.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.wireframe = newWireframe;
      }
    });
  }, [wireframe]);

  const toolbarProps = useMemo(() => ({
    tool,
    setTool,
    brushSize,
    setBrushSize,
    brushColor,
    setBrushColor,
    onImageUpload: handleImageUpload,
    onClear: handleClearCanvas, // Используем новую обёртку
    onUndo: undo,
    onRedo: redo,
    canUndo,
    canRedo,
    isTransformMode,
    imageTransform,
    setImageTransform,
    onApplyImage: applyImage,
    onCancelImage: cancelTransform,
    isMobile
  }), [
    tool, brushSize, brushColor, handleImageUpload, handleClearCanvas,
    undo, redo, canUndo, canRedo, isTransformMode, imageTransform,
    setImageTransform, applyImage, cancelTransform, isMobile
  ]);

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col lg:flex-row overflow-hidden">
      
      {/* Мобильный хедер */}
      {isMobile && (
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
          <h1 className="text-lg font-semibold text-gray-900">Дизайнер Одежды</h1>
          <button
            onClick={() => setShowTools(!showTools)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 transition-colors"
            aria-label="Показать/скрыть инструменты"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </header>
      )}

      {/* 3D вьюпорт */}
      <main className="flex-1 flex flex-col bg-white lg:rounded-2xl lg:m-4 lg:shadow-xl overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleWireframe}
                disabled={loading}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  wireframe 
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5z" />
                </svg>
                {wireframe ? 'Сплошной' : 'Каркас'}
              </button>
              
              <button
                onClick={downloadTexture}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition-all shadow-lg shadow-green-500/30 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Экспорт
              </button>
            </div>
            
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Загрузка модели...
              </div>
            )}
          </div>
        </div>
        
        <div ref={containerRef} className="flex-1 relative touch-none" />
      </main>

      {/* Боковая панель */}
      <aside 
        className={`${
          isMobile 
            ? `fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl transform transition-transform duration-300 ease-out ${
                showTools ? 'translate-y-0' : 'translate-y-full'
              } z-50 max-h-[70vh] overflow-auto`
            : 'w-96 bg-white lg:rounded-2xl lg:m-4 lg:ml-0 lg:shadow-xl flex flex-col overflow-hidden'
        }`}
      >
        {isMobile && (
          <div className="flex justify-center pt-2 pb-4 flex-shrink-0">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>
        )}

        <div className="p-4 border-b border-gray-200 flex-shrink-0">
          <canvas
            ref={uvCanvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className={`w-full border-2 border-gray-200 rounded-2xl bg-white shadow-lg touch-none ${
              isTransformMode ? 'cursor-move' : 'cursor-crosshair'
            }`}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          />
        </div>

        <div className="flex-1 overflow-auto">
          <Toolbar {...toolbarProps} />
        </div>
      </aside>
    </div>
  );
}