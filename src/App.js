import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Константы
const CANVAS_SIZE = 2048;
const MODEL_PATH = '/materials/model.glb';
const UV_LAYOUT_PATH = '/materials/uv-layout.png';
const COLOR_PRESETS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FF6B35', '#004E89'
];
const MAX_HISTORY = 30;

// Типы инструментов
const TOOLS = {
  DRAW: 'draw',
  ERASE: 'erase',
  TEXT: 'text'
};

export default function GarmentDesigner() {
  // Canvas refs
  const containerRef = useRef(null);
  const uvCanvasRef = useRef(null);
  const drawingLayerRef = useRef(null);
  
  // Three.js refs
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const textureRef = useRef(null);
  const meshRef = useRef(null);
  const modelGroupRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // Состояния
  const [tool, setTool] = useState(TOOLS.DRAW);
  const [brushSize, setBrushSize] = useState(15);
  const [brushColor, setBrushColor] = useState('#000000');
  const [fontSize, setFontSize] = useState(48);
  const [textInput, setTextInput] = useState('');
  
  const [model, setModel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  
  const [uvLayoutImage, setUvLayoutImage] = useState(null);
  const [designImage, setDesignImage] = useState(null);
  const [imageTransform, setImageTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
  });
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [isTransformMode, setIsTransformMode] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastDrawPoint, setLastDrawPoint] = useState(null);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [isMobile, setIsMobile] = useState(false);
  const [showTools, setShowTools] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(true);

  // Проверка мобильного устройства
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Инициализация UV canvas
  const initUVCanvas = useCallback(() => {
    if (!uvCanvasRef.current) return;
    
    const canvas = uvCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Очистка canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    
    // Рисование пользовательского слоя
    if (drawingLayerRef.current) {
      ctx.drawImage(drawingLayerRef.current, 0, 0);
    }
    
    // Рисование изображения в режиме трансформации
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
    
    // Рисование UV разметки
    if (uvLayoutImage) {
      ctx.globalAlpha = 0.2;
      ctx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.globalAlpha = 1.0;
    }
    
    // Обновление 3D текстуры
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
  }, [uvLayoutImage, designImage, imageTransform]);

  // Загрузка UV разметки
  const loadUVLayout = useCallback(() => {
    const img = new Image();
    img.onload = () => setUvLayoutImage(img);
    img.onerror = () => console.error('Не удалось загрузить UV разметку');
    img.src = UV_LAYOUT_PATH;
  }, []);

  // Инициализация Three.js сцены
  useEffect(() => {
    if (!containerRef.current || rendererRef.current) return;

    // Настройка сцены
    const scene = new THREE.Scene();
    
    // Градиентный фон
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1a1a1a');
    gradient.addColorStop(1, '#2d2d2d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);
    scene.background = new THREE.CanvasTexture(canvas);
    sceneRef.current = scene;

    // Настройка камеры
    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.001,
      10000
    );
    camera.position.set(0, 2, 5);
    cameraRef.current = camera;

    // Настройка рендера
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Настройка контролов
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.1;
    controls.maxDistance = 100;
    controlsRef.current = controls;

    // Настройка освещения
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(3, 4, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-3, 2, 3);
    scene.add(fillLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
    backLight.position.set(0, 3, -3);
    scene.add(backLight);

    const accentLight1 = new THREE.PointLight(0x4488ff, 0.3, 10);
    accentLight1.position.set(-2, 1, -2);
    scene.add(accentLight1);

    const accentLight2 = new THREE.PointLight(0xff8844, 0.2, 10);
    accentLight2.position.set(2, 1, -2);
    scene.add(accentLight2);

    // Плоскость земли
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    scene.add(ground);

    // Цикл анимации
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Обработка изменения размера окна
    const handleResize = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Загрузка ресурсов
    loadUVLayout();

    // Очистка
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

  // Загрузка 3D модели
  useEffect(() => {
    if (!sceneRef.current || model) return;
    
    setLoading(true);
    const loader = new GLTFLoader();

    loader.load(
      MODEL_PATH,
      (gltf) => {
        const loadedModel = gltf.scene;
        modelGroupRef.current = loadedModel;
        
        // Создание текстуры из UV canvas
        const texture = new THREE.CanvasTexture(uvCanvasRef.current);
        texture.flipY = false;
        textureRef.current = texture;

        // Применение материала ко всем мешам
        loadedModel.traverse((child) => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              map: texture,
              side: THREE.DoubleSide,
              metalness: 0.05,
              roughness: 0.7,
              color: 0xffffff,
            });
            
            if (!meshRef.current) meshRef.current = child;
          }
        });

        sceneRef.current.add(loadedModel);

        // Центрирование и масштабирование модели
        const box = new THREE.Box3().setFromObject(loadedModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        loadedModel.position.sub(center);
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        loadedModel.scale.multiplyScalar(scale);
        
        // Позиционирование камеры
        const fov = cameraRef.current.fov * (Math.PI / 180);
        const cameraZ = Math.abs(2 / Math.tan(fov / 2)) * 1.5;

        cameraRef.current.position.set(0, 0.5, cameraZ);
        cameraRef.current.lookAt(0, 0, 0);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();

        setModel(loadedModel);
        setLoading(false);
      },
      undefined,
      (error) => {
        console.error('Ошибка загрузки модели:', error);
        setLoading(false);
      }
    );
  }, [model]);

  // Обновление UV canvas при изменении зависимостей
  useEffect(() => {
    if (uvCanvasRef.current) {
      initUVCanvas();
    }
  }, [initUVCanvas]);

  // Управление историей
  const saveToHistory = useCallback(() => {
    if (!drawingLayerRef.current) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(drawingLayerRef.current, 0, 0);
    
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(canvas.toDataURL());
    
    // Ограничение размера истории
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    } else {
      setHistoryIndex(prev => prev + 1);
    }
    
    setHistory(newHistory);
  }, [history, historyIndex]);

  const restoreFromHistory = useCallback((index) => {
    const img = new Image();
    img.onload = () => {
      if (!drawingLayerRef.current) {
        drawingLayerRef.current = document.createElement('canvas');
        drawingLayerRef.current.width = CANVAS_SIZE;
        drawingLayerRef.current.height = CANVAS_SIZE;
      }
      const ctx = drawingLayerRef.current.getContext('2d');
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.drawImage(img, 0, 0);
      initUVCanvas();
    };
    img.src = history[index];
  }, [history, initUVCanvas]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    restoreFromHistory(newIndex);
  }, [historyIndex, restoreFromHistory]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    restoreFromHistory(newIndex);
  }, [historyIndex, history.length, restoreFromHistory]);

  // Проверка, находится ли пиксель в UV маске
  const isPixelInUVMask = useCallback((x, y) => {
    if (!uvLayoutImage) return true;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(uvLayoutImage, x, y, 1, 1, 0, 0, 1, 1);
    const pixel = tempCtx.getImageData(0, 0, 1, 1).data;
    
    return pixel[3] > 0;
  }, [uvLayoutImage]);

  // Функции рисования
  const drawLine = useCallback((x0, y0, x1, y1, drawingCtx) => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = CANVAS_SIZE;
    tempCanvas.height = CANVAS_SIZE;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.lineCap = 'round';
    tempCtx.lineJoin = 'round';
    
    if (tool === TOOLS.DRAW) {
      tempCtx.strokeStyle = brushColor;
      tempCtx.lineWidth = brushSize * 2;
      tempCtx.beginPath();
      tempCtx.moveTo(x0, y0);
      tempCtx.lineTo(x1, y1);
      tempCtx.stroke();
      
      // Обрезка по UV маске
      if (uvLayoutImage) {
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      }
      
      drawingCtx.drawImage(tempCanvas, 0, 0);
      
    } else if (tool === TOOLS.ERASE) {
      tempCtx.strokeStyle = 'white';
      tempCtx.lineWidth = brushSize * 2;
      tempCtx.beginPath();
      tempCtx.moveTo(x0, y0);
      tempCtx.lineTo(x1, y1);
      tempCtx.stroke();
      
      drawingCtx.save();
      drawingCtx.globalCompositeOperation = 'destination-out';
      drawingCtx.drawImage(tempCanvas, 0, 0);
      drawingCtx.restore();
    }
  }, [tool, brushColor, brushSize, uvLayoutImage]);

  const drawOnCanvas = useCallback((x, y, forceNew = false) => {
    if (!uvCanvasRef.current) return;
    
    // Инициализация слоя для рисования
    if (!drawingLayerRef.current) {
      drawingLayerRef.current = document.createElement('canvas');
      drawingLayerRef.current.width = CANVAS_SIZE;
      drawingLayerRef.current.height = CANVAS_SIZE;
    }
    
    const drawingCtx = drawingLayerRef.current.getContext('2d');
    
    if (tool === TOOLS.DRAW || tool === TOOLS.ERASE) {
      if (lastDrawPoint && !forceNew) {
        drawLine(lastDrawPoint.x, lastDrawPoint.y, x, y, drawingCtx);
      } else {
        if (tool === TOOLS.DRAW) {
          if (isPixelInUVMask(Math.round(x), Math.round(y))) {
            drawingCtx.fillStyle = brushColor;
            drawingCtx.beginPath();
            drawingCtx.arc(x, y, brushSize, 0, Math.PI * 2);
            drawingCtx.fill();
          }
        } else {
          drawingCtx.clearRect(x - brushSize, y - brushSize, brushSize * 2, brushSize * 2);
        }
      }
      
      setLastDrawPoint({ x, y });
      
    } else if (tool === TOOLS.TEXT && textInput) {
      if (!isPixelInUVMask(Math.round(x), Math.round(y))) return;
      
      drawingCtx.fillStyle = brushColor;
      drawingCtx.font = `${fontSize}px Arial`;
      drawingCtx.fillText(textInput, x, y);
    }
    
    initUVCanvas();
  }, [tool, brushColor, brushSize, fontSize, textInput, lastDrawPoint, drawLine, isPixelInUVMask, initUVCanvas]);

  // Обработчики взаимодействия с canvas
  const getCanvasCoords = useCallback((e) => {
    const rect = uvCanvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (CANVAS_SIZE / rect.width),
      y: (clientY - rect.top) * (CANVAS_SIZE / rect.height)
    };
  }, []);

  const handleStart = useCallback((e) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);

    // Обработка режима трансформации изображения
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

    // Обработка инструмента текста
    if (tool === TOOLS.TEXT) {
      drawOnCanvas(x, y, true);
      saveToHistory();
      return;
    }

    // Начало рисования
    setIsDrawing(true);
    setLastDrawPoint(null);
    drawOnCanvas(x, y, true);
  }, [isTransformMode, designImage, tool, imageTransform, getCanvasCoords, drawOnCanvas, saveToHistory]);

  const handleMove = useCallback((e) => {
    e.preventDefault();
    
    // Обработка масштабирования щипком в режиме трансформации
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

    const { x, y } = getCanvasCoords(e);

    // Обработка перетаскивания изображения
    if (isDraggingImage) {
      setImageTransform(prev => ({
        ...prev,
        x: x - dragStart.x,
        y: y - dragStart.y
      }));
      return;
    }

    // Обработка рисования
    if (isDrawing && tool !== TOOLS.TEXT) {
      drawOnCanvas(x, y);
    }
  }, [isTransformMode, isDraggingImage, isDrawing, tool, lastTouchDistance, dragStart, getCanvasCoords, drawOnCanvas]);

  const handleEnd = useCallback(() => {
    if (isDrawing) {
      saveToHistory();
    }
    setIsDrawing(false);
    setIsDraggingImage(false);
    setLastTouchDistance(0);
    setLastDrawPoint(null);
  }, [isDrawing, saveToHistory]);

  // Обработчики действий
  const clearTexture = useCallback(() => {
    drawingLayerRef.current = null;
    setHistory([]);
    setHistoryIndex(-1);
    initUVCanvas();
  }, [initUVCanvas]);

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
    
    // Рисование трансформированного изображения
    tempCtx.save();
    const imgW = CANVAS_SIZE * imageTransform.scale;
    const imgH = CANVAS_SIZE * imageTransform.scale;
    const centerX = CANVAS_SIZE / 2 + imageTransform.x;
    const centerY = CANVAS_SIZE / 2 + imageTransform.y;
    
    tempCtx.translate(centerX, centerY);
    tempCtx.rotate(imageTransform.rotation * Math.PI / 180);
    tempCtx.drawImage(designImage, -imgW / 2, -imgH / 2, imgW, imgH);
    tempCtx.restore();
    
    // Обрезка по UV маске
    if (uvLayoutImage) {
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    
    // Слияние с существующим рисунком
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
  }, [designImage, imageTransform, uvLayoutImage, saveToHistory, initUVCanvas]);

  const cancelImageTransform = useCallback(() => {
    setDesignImage(null);
    setIsTransformMode(false);
    initUVCanvas();
  }, [initUVCanvas]);

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col lg:flex-row overflow-hidden">
      {/* Модальное окно приветствия */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Добро пожаловать в Дизайнер Одежды!</h2>
              <p className="text-gray-600">Создавайте уникальные дизайны на 3D моделях одежды</p>
            </div>
            
            <div className="space-y-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🎨</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Рисование и дизайн</h3>
                  <p className="text-sm text-gray-600">Используйте кисти, текст и изображения для создания дизайна</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">👁️</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">3D предпросмотр</h3>
                  <p className="text-sm text-gray-600">Смотрите свой дизайн на 3D модели в реальном времени</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">💾</span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Экспорт</h3>
                  <p className="text-sm text-gray-600">Скачайте свой дизайн для печати или дальнейшего редактирования</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setShowOnboarding(false)}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Начать работу!
            </button>
          </div>
        </div>
      )}

      {/* Мобильный заголовок */}
      {isMobile && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Дизайнер Одежды</h1>
          <button
            onClick={() => setShowTools(!showTools)}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Переключить панель инструментов"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      )}

      {/* Панель 3D просмотра */}
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
                title="Переключить режим каркаса"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                </svg>
                {wireframe ? 'Сплошной' : 'Каркас'}
              </button>
              
              <button
                onClick={downloadTexture}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-all shadow-lg shadow-green-500/30 flex items-center gap-2"
                title="Скачать ваш дизайн"
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

      {/* Панель инструментов */}
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

        <div className="p-4">
          {/* Заголовок панели */}
          <h2 className="text-base font-semibold text-gray-900 mb-4">Панель Инструментов Дизайна</h2>
          
          {/* Кнопки инструментов */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { id: TOOLS.DRAW, icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', label: 'Рисование' },
              { id: TOOLS.ERASE, icon: 'M6 18L18 6M6 6l12 12', label: 'Ластик' },
              { id: TOOLS.TEXT, icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129', label: 'Текст' }
            ].map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setTool(id)}
                className={`py-4 px-2 rounded-xl text-xs font-medium transition-all flex flex-col items-center justify-center gap-2 ${
                  tool === id
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={label}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
                </svg>
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>

          {/* Секция свойств */}
          {!isTransformMode && (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-gray-900">Свойства</h3>
              
              {/* Размер кисти */}
              {(tool === TOOLS.DRAW || tool === TOOLS.ERASE) && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-medium text-gray-700">Размер кисти</label>
                    <span className="text-xs text-gray-500">{brushSize}px</span>
                  </div>
                  <input
                    type="range"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    min="5"
                    max="100"
                  />
                </div>
              )}

              {/* Цвет */}
              <div>
                <label className="text-xs font-medium text-gray-700 mb-3 block">Цвет</label>
                <div className="grid grid-cols-10 gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setBrushColor(color)}
                      className={`w-full aspect-square rounded-lg border-2 transition-all ${
                        brushColor === color 
                          ? 'border-blue-500 ring-2 ring-blue-200 scale-110' 
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Текст - только если выбран инструмент "Текст" */}
              {tool === TOOLS.TEXT && (
                <>
                  <div>
                    <label className="text-xs font-medium text-gray-700 mb-2 block">Текст</label>
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Введите текст..."
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-medium text-gray-700">Размер шрифта</label>
                      <span className="text-xs text-gray-500">{fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      min="24"
                      max="200"
                    />
                  </div>
                </>
              )}

              {/* Разделитель */}
              <div className="border-t border-gray-200 my-4"></div>

              {/* Кнопки действий */}
              <div className="space-y-2">
                <button
                  onClick={() => document.querySelector('input[type="file"]').click()}
                  className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Добавить изображение
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleDesignImageUpload}
                    className="hidden"
                  />
                </button>
                
                <button
                  onClick={clearTexture}
                  className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Очистить холст
                </button>

                {/* Разделитель */}
                <div className="border-t border-gray-200 my-3"></div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={undo}
                    disabled={historyIndex <= 0}
                    className="py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                    title="Отменить последнее действие"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    <span className="text-xs">Отменить</span>
                  </button>
                  <button
                    onClick={redo}
                    disabled={historyIndex >= history.length - 1}
                    className="py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                    title="Повторить последнее действие"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                    </svg>
                    <span className="text-xs">Повторить</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Режим трансформации изображения */}
          {isTransformMode && designImage && (
            <div className="space-y-5">
              <div className="text-center py-2 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-sm font-semibold text-blue-700">🔧 Режим трансформации</span>
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-gray-700">Масштаб</label>
                  <span className="text-xs text-gray-500">{imageTransform.scale.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={imageTransform.scale}
                  onChange={(e) => setImageTransform(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-gray-700">Поворот</label>
                  <span className="text-xs text-gray-500">{imageTransform.rotation}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={imageTransform.rotation}
                  onChange={(e) => setImageTransform(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div className="text-xs text-gray-500 text-center bg-gray-50 p-3 rounded-lg">
                {isMobile ? '📱 Перетащите для перемещения • Сведите пальцы для масштабирования' : '🖱️ Перетащите для изменения позиции на холсте'}
              </div>

              <div className="space-y-2">
                <button
                  onClick={applyImageToCanvas}
                  className="w-full py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all text-sm font-semibold shadow-md"
                >
                  ✓ Применить
                </button>
                <button
                  onClick={cancelImageTransform}
                  className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm font-semibold"
                >
                  ✕ Отменить
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Контейнер холста для рисования */}
        <div className="flex-1 overflow-auto p-4 border-t border-gray-200">
          <div className="mb-3 text-center">
            <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase">
              {isTransformMode ? '🔧 Режим трансформации' : '🎨 Холст для рисования'}
            </p>
          </div>

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
      </div>
    </div>
  );
}