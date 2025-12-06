import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export default function GarmentDesigner() {
  const containerRef = useRef(null);
  const uvCanvasRef = useRef(null);
  const drawingLayerRef = useRef(null);
  
  const [brushSize, setBrushSize] = useState(15);
  const [brushColor, setBrushColor] = useState('#000000');
  const [tool, setTool] = useState('draw');
  const [model, setModel] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [fontSize, setFontSize] = useState(48);
  const [textInput, setTextInput] = useState('');
  const [uvLayoutImage, setUvLayoutImage] = useState(null);
  const [designImage, setDesignImage] = useState(null);
  const [imageTransform, setImageTransform] = useState({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
  });
  const [isTransformMode, setIsTransformMode] = useState(false);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showTools, setShowTools] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [lastDrawPoint, setLastDrawPoint] = useState(null);
  
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const textureRef = useRef(null);
  const meshRef = useRef(null);
  const modelGroupRef = useRef(null);
  const modelLoadedRef = useRef(false);

  const MODEL_PATH = '/materials/model.glb';
  const UV_LAYOUT_PATH = '/materials/uv-layout.png';

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!containerRef.current || rendererRef.current) return;

    const scene = new THREE.Scene();
    
    // Gradient background (dark to lighter)
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#1a1a1a');
    gradient.addColorStop(1, '#2d2d2d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 2, 512);
    
    const texture = new THREE.CanvasTexture(canvas);
    scene.background = texture;
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.001,
      10000
    );
    camera.position.set(0, 2, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.1;
    controls.maxDistance = 100;
    controlsRef.current = controls;

    // Studio lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Key light (main light from front-right)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(3, 4, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    scene.add(keyLight);

    // Fill light (softer from left)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-3, 2, 3);
    scene.add(fillLight);

    // Back light (rim light)
    const backLight = new THREE.DirectionalLight(0xffffff, 0.8);
    backLight.position.set(0, 3, -3);
    scene.add(backLight);

    // Subtle colored accent lights
    const accentLight1 = new THREE.PointLight(0x4488ff, 0.3, 10);
    accentLight1.position.set(-2, 1, -2);
    scene.add(accentLight1);

    const accentLight2 = new THREE.PointLight(0xff8844, 0.2, 10);
    accentLight2.position.set(2, 1, -2);
    scene.add(accentLight2);

    // Ground plane with subtle reflection
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.15 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true;
    scene.add(ground);

    function animate() {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
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
    loadModel();

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current && renderer.domElement && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  const loadUVLayout = () => {
    const img = new Image();
    img.onload = () => setUvLayoutImage(img);
    img.onerror = () => console.error('Failed to load UV layout');
    img.src = UV_LAYOUT_PATH;
  };

  const initUVCanvas = () => {
    if (!uvCanvasRef.current) return;
    
    const canvas = uvCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    
    if (drawingLayerRef.current) {
      ctx.drawImage(drawingLayerRef.current, 0, 0);
    }
    
    if (designImage) {
      ctx.save();
      const imgW = w * imageTransform.scale;
      const imgH = h * imageTransform.scale;
      const centerX = w / 2 + imageTransform.x;
      const centerY = h / 2 + imageTransform.y;
      
      ctx.translate(centerX, centerY);
      ctx.rotate(imageTransform.rotation * Math.PI / 180);
      ctx.drawImage(designImage, -imgW / 2, -imgH / 2, imgW, imgH);
      ctx.restore();
    }
    
    if (uvLayoutImage) {
      ctx.globalAlpha = 0.2;
      ctx.drawImage(uvLayoutImage, 0, 0, w, h);
      ctx.globalAlpha = 1.0;
    }
    
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
  };

  useEffect(() => {
    if (uvCanvasRef.current) {
      initUVCanvas();
    }
  }, [uvLayoutImage, designImage, imageTransform]);

  const loadModel = () => {
    if (modelLoadedRef.current) {
      console.log('⚠️ Модель уже загружается или загружена');
      return;
    }
    
    modelLoadedRef.current = true;
    setLoading(true);
    const loader = new GLTFLoader();

    console.log('🔄 Начинаем загрузку модели:', MODEL_PATH);

    loader.load(
      MODEL_PATH,
      (gltf) => {
        console.log('✅ Модель загружена!', gltf);
        const loadedModel = gltf.scene;
        
        let meshCount = 0;
        loadedModel.traverse((child) => {
          console.log('Найден объект:', child.type, child.name);
          if (child.isMesh) {
            meshCount++;
            console.log('  └─ Mesh найден!', child.geometry);
          }
        });
        console.log('📊 Всего мешей:', meshCount);
        
        if (meshCount === 0) {
          console.error('❌ В модели нет мешей!');
          return;
        }

        modelGroupRef.current = loadedModel;
        
        const texture = new THREE.CanvasTexture(uvCanvasRef.current);
        texture.flipY = false;
        texture.needsUpdate = true;
        textureRef.current = texture;

        loadedModel.traverse((child) => {
          if (child.isMesh) {
            const material = new THREE.MeshStandardMaterial({
              map: texture,
              side: THREE.DoubleSide,
              metalness: 0.05,
              roughness: 0.7,
              color: 0xffffff,
            });
            
            child.material = material;
            child.material.needsUpdate = true;
            
            if (!meshRef.current) {
              meshRef.current = child;
            }
          }
        });

        sceneRef.current.add(loadedModel);
        console.log('➕ Модель добавлена в сцену');
        console.log('📦 Объектов в сцене:', sceneRef.current.children.length);

        const box = new THREE.Box3().setFromObject(loadedModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        console.log('📦 Размеры модели:', {
          width: size.x,
          height: size.y,
          depth: size.z,
          center: { x: center.x, y: center.y, z: center.z }
        });
        
        loadedModel.position.sub(center);
        console.log('📍 Центрирование:', loadedModel.position);
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 2 / maxDim;
        loadedModel.scale.multiplyScalar(scale);
        
        console.log('📏 Масштаб:', scale, 'Финальный scale:', loadedModel.scale);
        
        const fov = cameraRef.current.fov * (Math.PI / 180);
        let cameraZ = Math.abs(2 / Math.tan(fov / 2)) * 1.5;

        cameraRef.current.position.set(0, 0.5, cameraZ);
        cameraRef.current.lookAt(0, 0, 0);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();

        console.log('📷 Камера на позиции:', cameraRef.current.position);

        setModel(loadedModel);
        setLoading(false);
        console.log('✨ Загрузка завершена!');
      },
      (progress) => {
        if (progress.total > 0) {
          const percent = (progress.loaded / progress.total * 100).toFixed(1);
          console.log(`⏳ Загрузка: ${percent}%`);
        }
      },
      (error) => {
        console.error('❌ ОШИБКА загрузки модели:', error);
        modelLoadedRef.current = false;
        setLoading(false);
      }
    );
  };

  const isPixelInUVMask = (x, y) => {
    if (!uvLayoutImage) return true;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 1;
    tempCanvas.height = 1;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.drawImage(
      uvLayoutImage,
      x, y, 1, 1,
      0, 0, 1, 1
    );
    
    const pixel = tempCtx.getImageData(0, 0, 1, 1).data;
    
    return pixel[3] > 0;
  };

  const drawLine = (x0, y0, x1, y1, drawingCtx) => {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = drawingLayerRef.current.width;
    tempCanvas.height = drawingLayerRef.current.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.lineCap = 'round';
    tempCtx.lineJoin = 'round';
    
    if (tool === 'draw') {
      tempCtx.strokeStyle = brushColor;
      tempCtx.lineWidth = brushSize * 2;
      tempCtx.beginPath();
      tempCtx.moveTo(x0, y0);
      tempCtx.lineTo(x1, y1);
      tempCtx.stroke();
      
      if (uvLayoutImage) {
        tempCtx.globalCompositeOperation = 'destination-in';
        tempCtx.drawImage(uvLayoutImage, 0, 0, tempCanvas.width, tempCanvas.height);
      }
      
      drawingCtx.drawImage(tempCanvas, 0, 0);
      
    } else if (tool === 'erase') {
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
  };

  const drawOnCanvas = (x, y, forceNew = false) => {
    if (!uvCanvasRef.current) return;
    
    const canvas = uvCanvasRef.current;
    
    if (tool === 'draw' || tool === 'erase') {
      if (!drawingLayerRef.current) {
        drawingLayerRef.current = document.createElement('canvas');
        drawingLayerRef.current.width = canvas.width;
        drawingLayerRef.current.height = canvas.height;
      }
      
      const drawingCtx = drawingLayerRef.current.getContext('2d');
      
      if (lastDrawPoint && !forceNew) {
        drawLine(lastDrawPoint.x, lastDrawPoint.y, x, y, drawingCtx);
      } else {
        if (tool === 'draw') {
          if (isPixelInUVMask(Math.round(x), Math.round(y))) {
            drawingCtx.fillStyle = brushColor;
            drawingCtx.beginPath();
            drawingCtx.arc(x, y, brushSize, 0, Math.PI * 2);
            drawingCtx.fill();
          }
        } else if (tool === 'erase') {
          drawingCtx.clearRect(x - brushSize, y - brushSize, brushSize * 2, brushSize * 2);
        }
      }
      
      setLastDrawPoint({ x, y });
      
      initUVCanvas();
    } else if (tool === 'text' && textInput) {
      if (!isPixelInUVMask(Math.round(x), Math.round(y))) return;
      
      if (!drawingLayerRef.current) {
        drawingLayerRef.current = document.createElement('canvas');
        drawingLayerRef.current.width = canvas.width;
        drawingLayerRef.current.height = canvas.height;
      }
      
      const drawingCtx = drawingLayerRef.current.getContext('2d');
      drawingCtx.fillStyle = brushColor;
      drawingCtx.font = `${fontSize}px Arial`;
      drawingCtx.fillText(textInput, x, y);
      
      initUVCanvas();
    }
    
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
  };

  const getCanvasCoords = (e) => {
    const rect = uvCanvasRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (uvCanvasRef.current.width / rect.width),
      y: (clientY - rect.top) * (uvCanvasRef.current.height / rect.height)
    };
  };

  const handleStart = (e) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);

    if (isTransformMode && designImage) {
      if (e.touches && e.touches.length === 2) {
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

    if (tool === 'text') {
      drawOnCanvas(x, y, true);
      return;
    }

    setIsDrawing(true);
    setLastDrawPoint(null);
    drawOnCanvas(x, y, true);
  };

  const handleMove = (e) => {
    e.preventDefault();
    
    if (isTransformMode && e.touches && e.touches.length === 2) {
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

    if (isDraggingImage) {
      setImageTransform(prev => ({
        ...prev,
        x: x - dragStart.x,
        y: y - dragStart.y
      }));
      return;
    }

    if (!isDrawing || tool === 'text') return;
    drawOnCanvas(x, y);
  };

  const handleEnd = () => {
    setIsDrawing(false);
    setIsDraggingImage(false);
    setLastTouchDistance(0);
    setLastDrawPoint(null);
  };

  const clearTexture = () => {
    drawingLayerRef.current = null;
    initUVCanvas();
  };

  const downloadTexture = () => {
    if (!uvCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'garment-design.png';
    link.href = uvCanvasRef.current.toDataURL();
    link.click();
  };

  const toggleWireframe = () => {
    if (!model) return;
    const newWireframe = !wireframe;
    setWireframe(newWireframe);
    model.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.wireframe = newWireframe;
      }
    });
  };

  const handleDesignImageUpload = (event) => {
    const file = event.target.files[0];
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
  };

  const applyImageToCanvas = () => {
    if (!uvCanvasRef.current || !designImage) return;
    
    const canvas = uvCanvasRef.current;
    const w = canvas.width;
    const h = canvas.height;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.save();
    const imgW = w * imageTransform.scale;
    const imgH = h * imageTransform.scale;
    const centerX = w / 2 + imageTransform.x;
    const centerY = h / 2 + imageTransform.y;
    
    tempCtx.translate(centerX, centerY);
    tempCtx.rotate(imageTransform.rotation * Math.PI / 180);
    tempCtx.drawImage(designImage, -imgW / 2, -imgH / 2, imgW, imgH);
    tempCtx.restore();
    
    if (uvLayoutImage) {
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(uvLayoutImage, 0, 0, w, h);
    }
    
    if (!drawingLayerRef.current) {
      drawingLayerRef.current = document.createElement('canvas');
      drawingLayerRef.current.width = w;
      drawingLayerRef.current.height = h;
    }
    const drawingCtx = drawingLayerRef.current.getContext('2d');
    
    const oldContent = document.createElement('canvas');
    oldContent.width = w;
    oldContent.height = h;
    oldContent.getContext('2d').drawImage(drawingLayerRef.current, 0, 0);
    
    drawingCtx.clearRect(0, 0, w, h);
    drawingCtx.drawImage(oldContent, 0, 0);
    drawingCtx.drawImage(tempCanvas, 0, 0);
    
    setDesignImage(null);
    setIsTransformMode(false);
    initUVCanvas();
  };

  return (
    <div className="w-full h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col lg:flex-row overflow-hidden">
      {isMobile && (
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Garment Designer</h1>
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={toggleWireframe}
              disabled={!model}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                wireframe 
                  ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {wireframe ? 'Solid' : 'Wireframe'}
            </button>
            <button
              onClick={downloadTexture}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-all shadow-lg shadow-green-500/30"
            >
              Export
            </button>
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                Loading...
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
          {!isTransformMode && (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setTool('draw')}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                    tool === 'draw'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Draw
                </button>
                <button
                  onClick={() => setTool('erase')}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                    tool === 'erase'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Erase
                </button>
                <button
                  onClick={() => setTool('text')}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                    tool === 'text'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Text
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">Color</label>
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => setBrushColor(e.target.value)}
                    className="w-full h-12 rounded-xl cursor-pointer border-2 border-gray-200"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600 mb-2 block">
                    Brush Size: {brushSize}px
                  </label>
                  <input
                    type="range"
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full"
                    min="5"
                    max="100"
                  />
                </div>

                {tool === 'text' && (
                  <>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-2 block">
                        Font Size: {fontSize}px
                      </label>
                      <input
                        type="range"
                        value={fontSize}
                        onChange={(e) => setFontSize(Number(e.target.value))}
                        className="w-full"
                        min="24"
                        max="200"
                      />
                    </div>
                    <input
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Enter text..."
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </>
                )}
              </div>

              <div className="flex gap-2">
                <label className="flex-1 py-3 bg-purple-500 text-white text-center rounded-xl cursor-pointer hover:bg-purple-600 transition-all text-sm font-medium shadow-lg shadow-purple-500/30">
                  Add Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleDesignImageUpload}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={clearTexture}
                  className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all text-sm font-medium shadow-lg shadow-red-500/30"
                >
                  Clear All
                </button>
              </div>
            </>
          )}

          {isTransformMode && designImage && (
            <div className="space-y-4">
              <div className="text-center py-2 bg-blue-50 rounded-xl">
                <span className="text-sm font-semibold text-blue-700">Transform Mode</span>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">
                  Scale: {imageTransform.scale.toFixed(1)}x
                </label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={imageTransform.scale}
                  onChange={(e) => setImageTransform(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 mb-2 block">
                  Rotate: {imageTransform.rotation}°
                </label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={imageTransform.rotation}
                  onChange={(e) => setImageTransform(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>

              <p className="text-xs text-gray-500 text-center">
                {isMobile ? 'Drag to move • Pinch to scale' : 'Drag to reposition on canvas'}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={applyImageToCanvas}
                  className="flex-1 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all text-sm font-semibold shadow-lg shadow-green-500/30"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setDesignImage(null);
                    setIsTransformMode(false);
                    initUVCanvas();
                  }}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all text-sm font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="mb-3 text-center">
            <p className="text-xs font-semibold text-gray-500 tracking-wide">
              {isTransformMode ? '🔧 TRANSFORM MODE' : '🎨 DRAWING CANVAS'}
            </p>
          </div>

          <canvas
            ref={uvCanvasRef}
            width="2048"
            height="2048"
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