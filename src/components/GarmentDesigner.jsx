import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { 
  CANVAS_SIZE, 
  MODEL_PATH, 
  UV_LAYOUT_PATH, 
  TOOLS 
} from '../utils/constants';
import { 
  createGradientBackground,
  setupCamera,
  setupRenderer,
  setupControls,
  setupLights,
  setupGround
} from '../utils/sceneSetup';
import { loadModel, positionCamera } from '../utils/modelLoader';
import { getCanvasCoords } from '../utils/drawingUtils';
import { useDrawing } from '../hooks/useDrawing';
import Toolbar from './Toolbar';

export default function GarmentDesigner() {
  const containerRef = useRef(null);
  const uvCanvasRef = useRef(null);
  
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const textureRef = useRef(null);
  const meshRef = useRef(null);
  const modelGroupRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  const [tool, setTool] = useState(TOOLS.DRAW);
  const [brushSize, setBrushSize] = useState(15);
  const [brushColor, setBrushColor] = useState('#000000');
  
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  
  const [uvLayoutImage, setUvLayoutImage] = useState(null);
  const [designImage, setDesignImage] = useState(null);
  const [imageTransform, setImageTransform] = useState({
    x: 0, y: 0, scale: 1, rotation: 0
  });
  
  const [isTransformMode, setIsTransformMode] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  
  const [isMobile, setIsMobile] = useState(false);
  const [showTools, setShowTools] = useState(true);

  const initUVCanvas = useCallback(() => {
    if (!uvCanvasRef.current) return;
    
    const canvas = uvCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    if (drawingLayerRef.current) {
      ctx.drawImage(drawingLayerRef.current, 0, 0);
    }
    
    if (designImage) {
      ctx.save();
      const imgW = CANVAS_SIZE * imageTransform.scale;
      const imgH = CANVAS_SIZE * imageTransform.scale;
      const centerX = CANVAS_SIZE / 2 + imageTransform.x;
      const centerY = CANVAS_SIZE / 2 + imageTransform.y;
      
      ctx.translate(centerX, centerY);
      ctx.rotate(imageTransform.rotation * Math.PI / 180);
      ctx.drawImage(designImage, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.restore();
    }
    
    if (uvLayoutImage) {
      ctx.globalAlpha = 0.2;
      ctx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.globalAlpha = 1.0;
    }
    
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
  }, [uvLayoutImage, designImage, imageTransform]);

  const {
    drawingLayerRef,
    isDrawing,
    setIsDrawing,
    lastDrawPoint,
    setLastDrawPoint,
    history,
    historyIndex,
    drawOnCanvas,
    saveToHistory,
    undo,
    redo,
    clearCanvas
  } = useDrawing(uvLayoutImage, initUVCanvas);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadUVLayout = useCallback(() => {
    const img = new Image();
    img.onload = () => setUvLayoutImage(img);
    img.onerror = () => console.error('Не удалось загрузить UV разметку');
    img.src = UV_LAYOUT_PATH;
  }, []);

  useEffect(() => {
    if (!containerRef.current || rendererRef.current) return;

    const scene = new THREE.Scene();
    scene.background = createGradientBackground();
    sceneRef.current = scene;

    const camera = setupCamera(containerRef.current);
    cameraRef.current = camera;

    const renderer = setupRenderer(containerRef.current);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = setupControls(camera, renderer.domElement);
    controlsRef.current = controls;

    setupLights(scene);
    setupGround(scene);

    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    loadUVLayout();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      renderer.dispose();
      if (containerRef.current?.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [loadUVLayout]);

  useEffect(() => {
    if (!sceneRef.current || model || !uvCanvasRef.current) return;
    
    setLoading(true);
    loadModel(
      MODEL_PATH,
      uvCanvasRef.current,
      (loadedModel, texture, firstMesh) => {
        modelGroupRef.current = loadedModel;
        textureRef.current = texture;
        meshRef.current = firstMesh;
        
        sceneRef.current.add(loadedModel);
        positionCamera(cameraRef.current, controlsRef.current);
        
        setModel(loadedModel);
        setLoading(false);
      },
      (error) => {
        console.error('Ошибка загрузки модели:', error);
        setLoading(false);
      }
    );
  }, [model]);

  useEffect(() => {
    if (uvCanvasRef.current) {
      initUVCanvas();
    }
  }, [initUVCanvas]);

  const handleStart = useCallback((e) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e, uvCanvasRef.current);

    if (isTransformMode && designImage) {
      if (e.touches?.length === 2) {
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        setLastTouchDistance(distance);
      } else {
        setIsDraggingImage(true);
        setDragStart({ x: x - imageTransform.x, y: y - imageTransform.y });
      }
      return;
    }

    setIsDrawing(true);
    setLastDrawPoint(null);
    drawOnCanvas(x, y, tool, brushColor, brushSize, true);
  }, [isTransformMode, designImage, tool, imageTransform, brushColor, brushSize, drawOnCanvas, setIsDrawing, setLastDrawPoint]);

  const handleMove = useCallback((e) => {
    e.preventDefault();
    
    if (isTransformMode && e.touches?.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      
      if (lastTouchDistance > 0) {
        const scale = distance / lastTouchDistance;
        setImageTransform(prev => ({
          ...prev,
          scale: Math.max(0.1, Math.min(3, prev.scale * scale))
        }));
      }
      setLastTouchDistance(distance);
      return;
    }

    const { x, y } = getCanvasCoords(e, uvCanvasRef.current);

    if (isDraggingImage) {
      setImageTransform(prev => ({
        ...prev,
        x: x - dragStart.x,
        y: y - dragStart.y
      }));
      return;
    }

    if (isDrawing) {
      drawOnCanvas(x, y, tool, brushColor, brushSize);
    }
  }, [isTransformMode, isDraggingImage, isDrawing, tool, lastTouchDistance, dragStart, brushColor, brushSize, drawOnCanvas]);

  const handleEnd = useCallback(() => {
    if (isDrawing) {
      saveToHistory();
    }
    setIsDrawing(false);
    setIsDraggingImage(false);
    setLastTouchDistance(0);
    setLastDrawPoint(null);
  }, [isDrawing, saveToHistory, setIsDrawing, setLastDrawPoint]);

  const downloadTexture = useCallback(() => {
    if (!uvCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'garment-design.png';
    link.href = uvCanvasRef.current.toDataURL();
    link.click();
  }, []);

  const toggleWireframe = useCallback(() => {
    if (!model) return;
    const newWireframe = !wireframe;
    setWireframe(newWireframe);
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.wireframe = newWireframe;
      }
    });
  }, [model, wireframe]);

  const handleDesignImageUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setDesignImage(img);
        setImageTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
        setIsTransformMode(true);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }, []);

  const applyImageToCanvas = useCallback(() => {
    if (!uvCanvasRef.current || !designImage) return;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_SIZE;
    tempCanvas.height = CANVAS_SIZE;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.save();
    const imgW = CANVAS_SIZE * imageTransform.scale;
    const imgH = CANVAS_SIZE * imageTransform.scale;
    const centerX = CANVAS_SIZE / 2 + imageTransform.x;
    const centerY = CANVAS_SIZE / 2 + imageTransform.y;
    
    tempCtx.translate(centerX, centerY);
    tempCtx.rotate(imageTransform.rotation * Math.PI / 180);
    tempCtx.drawImage(designImage, -imgW / 2, -imgH / 2, imgW, imgH);
    tempCtx.restore();
    
    if (uvLayoutImage) {
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    
    if (!drawingLayerRef.current) {
      drawingLayerRef.current = document.createElement('canvas');
      drawingLayerRef.current.width = CANVAS_SIZE;
      drawingLayerRef.current.height = CANVAS_SIZE;
    }
    
    const drawingCtx = drawingLayerRef.current.getContext('2d');
    const oldContent = document.createElement('canvas');
    oldContent.width = CANVAS_SIZE;
    oldContent.height = CANVAS_SIZE;
    oldContent.getContext('2d').drawImage(drawingLayerRef.current, 0, 0);
    
    drawingCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawingCtx.drawImage(oldContent, 0, 0);
    drawingCtx.drawImage(tempCanvas, 0, 0);
    
    setDesignImage(null);
    setIsTransformMode(false);
    saveToHistory();
    initUVCanvas();
  }, [designImage, imageTransform, uvLayoutImage, drawingLayerRef, saveToHistory, initUVCanvas]);

  const cancelImageTransform = useCallback(() => {
    setDesignImage(null);
    setIsTransformMode(false);
    initUVCanvas();
  }, [initUVCanvas]);

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col lg:flex-row overflow-hidden">

      {isMobile && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Дизайнер Одежды</h1>
          <button
            onClick={() => setShowTools(!showTools)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col bg-white lg:rounded-2xl lg:m-4 lg:shadow-xl overflow-hidden">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleWireframe}
                disabled={!model}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  wireframe 
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                </svg>
                {wireframe ? 'Сплошной' : 'Каркас'}
              </button>
              
              <button
                onClick={downloadTexture}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-all shadow-lg shadow-green-500/30 flex items-center gap-2"
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
        <div ref={containerRef} className="flex-1 relative" />
      </div>

      <div 
        className={`${
          isMobile 
            ? `fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl transform transition-transform duration-300 ${showTools ? 'translate-y-0' : 'translate-y-full'} z-50 max-h-[70vh] overflow-auto`
            : 'w-96 bg-white lg:rounded-2xl lg:m-4 lg:ml-0 lg:shadow-xl flex flex-col overflow-hidden'
        }`}
      >
        {isMobile && (
          <div className="flex justify-center pt-2 pb-4">
            <div className="w-12 h-1 bg-gray-300 rounded-full" />
          </div>
        )}

        <div className="p-4 border-b border-gray-200">
          <canvas
            ref={uvCanvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className={`w-full border-2 border-gray-200 rounded-2xl bg-white shadow-lg ${
              isTransformMode ? 'cursor-move' : 'cursor-crosshair'
            }`}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>

        <div className="flex-1 overflow-auto">
          <Toolbar
            tool={tool}
            setTool={setTool}
            brushSize={brushSize}
            setBrushSize={setBrushSize}
            brushColor={brushColor}
            setBrushColor={setBrushColor}
            onImageUpload={handleDesignImageUpload}
            onClear={clearCanvas}
            onUndo={undo}
            onRedo={redo}
            historyIndex={historyIndex}
            historyLength={history.length}
            isTransformMode={isTransformMode}
            imageTransform={imageTransform}
            setImageTransform={setImageTransform}
            onApplyImage={applyImageToCanvas}
            onCancelImage={cancelImageTransform}
            isMobile={isMobile}
          />
        </div>
      </div>
    </div>
  );
}