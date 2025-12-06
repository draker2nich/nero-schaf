import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export default function GarmentDesigner() {
  const containerRef = useRef(null);
  const uvCanvasRef = useRef(null);
  const drawingLayerRef = useRef(null);
  
  const [brushSize, setBrushSize] = useState(5);
  const [brushColor, setBrushColor] = useState('#000000');
  const [tool, setTool] = useState('draw');
  const [model, setModel] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wireframe, setWireframe] = useState(false);
  const [fontSize, setFontSize] = useState(12);
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
  
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const textureRef = useRef(null);
  const meshRef = useRef(null);
  const modelGroupRef = useRef(null);

  // Пути к локальным файлам
  const MODEL_PATH = '/materials/model.glb'; // Замени на свой путь
  const UV_LAYOUT_PATH = '/materials/uv-layout.png'; // Замени на свой путь

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a2a2a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1, 3);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight1.position.set(5, 5, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight2.position.set(-5, 3, -5);
    scene.add(directionalLight2);
    
    const directionalLight3 = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight3.position.set(0, -5, 0);
    scene.add(directionalLight3);

    const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0x444444);
    scene.add(gridHelper);

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

    // Загружаем UV layout
    loadUVLayout();
    
    // Загружаем модель
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
    img.onload = () => {
      setUvLayoutImage(img);
    };
    img.onerror = () => {
      console.error('Failed to load UV layout. Using default canvas.');
    };
    img.src = UV_LAYOUT_PATH;
  };

  const initUVCanvas = () => {
    if (!uvCanvasRef.current) return;
    
    const canvas = uvCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    // Белый фон
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    
    // Рисуем сохраненный слой рисования (если есть)
    if (drawingLayerRef.current) {
      ctx.drawImage(drawingLayerRef.current, 0, 0);
    }
    
    // Если загружено дизайн-изображение - рисуем его с трансформацией
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
    
    // Если загружен UV layout reference - рисуем его поверх полупрозрачно
    if (uvLayoutImage) {
      ctx.globalAlpha = 0.25;
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
    setLoading(true);

    const loader = new GLTFLoader();

    loader.load(
      MODEL_PATH,
      (gltf) => {
        const loadedModel = gltf.scene;
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
              metalness: 0.1,
              roughness: 0.8,
              color: 0xffffff,
              emissive: 0x222222,
              emissiveIntensity: 0.2
            });
            
            child.material = material;
            child.material.needsUpdate = true;
            child.castShadow = true;
            child.receiveShadow = true;
            child.visible = true;
            child.frustumCulled = false;
            
            if (!meshRef.current) {
              meshRef.current = child;
            }
          }
        });

        sceneRef.current.add(loadedModel);
        loadedModel.visible = true;

        const box = new THREE.Box3().setFromObject(loadedModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        loadedModel.position.sub(center);
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 2;
        const scale = targetSize / maxDim;
        loadedModel.scale.multiplyScalar(scale);
        
        const fov = cameraRef.current.fov * (Math.PI / 180);
        const scaledDim = targetSize;
        let cameraZ = Math.abs(scaledDim / Math.tan(fov / 2));
        cameraZ *= 1.8;

        cameraRef.current.position.set(0, scaledDim * 0.3, cameraZ);
        cameraRef.current.lookAt(0, 0, 0);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();

        setModel(loadedModel);
        setLoading(false);
      },
      undefined,
      (error) => {
        console.error('Error loading model:', error);
        alert('Ошибка загрузки модели. Проверьте путь: ' + MODEL_PATH);
        setLoading(false);
      }
    );
  };

  const drawOnCanvas = (x, y) => {
    if (!uvCanvasRef.current) return;
    
    const canvas = uvCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (tool === 'draw') {
      ctx.fillStyle = brushColor;
      ctx.beginPath();
      ctx.arc(x, y, brushSize, 0, Math.PI * 2);
      ctx.fill();
    } else if (tool === 'erase') {
      ctx.clearRect(x - brushSize, y - brushSize, brushSize * 2, brushSize * 2);
    } else if (tool === 'text' && textInput) {
      ctx.fillStyle = brushColor;
      ctx.font = `${fontSize}px Arial`;
      ctx.fillText(textInput, x, y);
    }
    
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
  };

  const handleUVMouseDown = (e) => {
    const rect = uvCanvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (uvCanvasRef.current.width / rect.width);
    const y = (e.clientY - rect.top) * (uvCanvasRef.current.height / rect.height);

    if (isTransformMode && designImage) {
      setIsDraggingImage(true);
      setDragStart({ x: x - imageTransform.x, y: y - imageTransform.y });
      return;
    }

    if (tool === 'text') {
      drawOnCanvas(x, y);
      return;
    }

    setIsDrawing(true);
    drawOnCanvas(x, y);
  };

  const handleUVMouseMove = (e) => {
    const rect = uvCanvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (uvCanvasRef.current.width / rect.width);
    const y = (e.clientY - rect.top) * (uvCanvasRef.current.height / rect.height);

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

  const handleUVMouseUp = () => {
    setIsDrawing(false);
    setIsDraggingImage(false);
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
    
    // Создаем временный canvas для изображения с трансформацией
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    
    // Рисуем изображение с трансформацией на временном canvas
    tempCtx.save();
    const imgW = w * imageTransform.scale;
    const imgH = h * imageTransform.scale;
    const centerX = w / 2 + imageTransform.x;
    const centerY = h / 2 + imageTransform.y;
    
    tempCtx.translate(centerX, centerY);
    tempCtx.rotate(imageTransform.rotation * Math.PI / 180);
    tempCtx.drawImage(designImage, -imgW / 2, -imgH / 2, imgW, imgH);
    tempCtx.restore();
    
    // Если есть UV layout - используем его как маску
    if (uvLayoutImage) {
      // Применяем маску: только непрозрачные области UV layout
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(uvLayoutImage, 0, 0, w, h);
    }
    
    // Сохраняем текущее содержимое как слой рисования
    if (!drawingLayerRef.current) {
      drawingLayerRef.current = document.createElement('canvas');
      drawingLayerRef.current.width = w;
      drawingLayerRef.current.height = h;
    }
    const drawingCtx = drawingLayerRef.current.getContext('2d');
    
    // Сначала копируем старое содержимое
    const oldContent = document.createElement('canvas');
    oldContent.width = w;
    oldContent.height = h;
    oldContent.getContext('2d').drawImage(drawingLayerRef.current, 0, 0);
    
    // Очищаем и рисуем старое содержимое
    drawingCtx.clearRect(0, 0, w, h);
    drawingCtx.drawImage(oldContent, 0, 0);
    
    // Накладываем новое изображение (уже с маской)
    drawingCtx.drawImage(tempCanvas, 0, 0);
    
    // Убираем режим трансформации
    setDesignImage(null);
    setIsTransformMode(false);
    
    // Перерисовываем canvas
    initUVCanvas();
  };

  return (
    <div className="w-full h-screen bg-gray-100 flex">
      <div className="flex-1 flex flex-col bg-gray-900">
        <div className="bg-gray-800 p-3 shadow-lg">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={clearTexture}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition text-sm"
            >
              Clear Canvas
            </button>
            <button
              onClick={downloadTexture}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition text-sm"
            >
              Download Texture
            </button>
            {model && (
              <button
                onClick={toggleWireframe}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded transition text-sm"
              >
                {wireframe ? 'Solid' : 'Wireframe'}
              </button>
            )}
            {loading && <span className="text-yellow-400 text-sm">⏳ Loading...</span>}
            {model && !loading && <span className="text-green-400 text-sm">✓ Model Loaded</span>}
            {uvLayoutImage && <span className="text-blue-400 text-sm">✓ UV Layout Loaded</span>}
          </div>
        </div>

        <div ref={containerRef} className="flex-1" />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-gray-800 bg-opacity-95 text-white p-8 rounded-lg text-center max-w-md">
              <h2 className="text-2xl font-bold mb-2">Loading Model...</h2>
              <p className="text-gray-300">Please wait</p>
            </div>
          </div>
        )}
      </div>

      <div className="w-96 bg-white border-l flex flex-col">
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <button
              onClick={() => setTool('draw')}
              disabled={isTransformMode}
              className={`flex items-center gap-2 px-3 py-2 rounded transition ${
                tool === 'draw' && !isTransformMode ? 'bg-orange-500 text-white' : 'bg-gray-200'
              } ${isTransformMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Draw"
            >
              ✏️
            </button>
            <button
              onClick={() => setTool('erase')}
              disabled={isTransformMode}
              className={`flex items-center gap-2 px-3 py-2 rounded transition ${
                tool === 'erase' && !isTransformMode ? 'bg-orange-500 text-white' : 'bg-gray-200'
              } ${isTransformMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Erase"
            >
              🧹
            </button>
            <input
              type="color"
              value={brushColor}
              onChange={(e) => setBrushColor(e.target.value)}
              disabled={isTransformMode}
              className="w-10 h-10 rounded cursor-pointer border-2"
            />
            <input
              type="number"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              disabled={isTransformMode}
              className="w-16 px-2 py-2 border rounded"
              min="1"
              max="50"
            />
            <label className={`bg-pink-600 hover:bg-pink-700 text-white px-3 py-2 rounded cursor-pointer transition text-sm ${isTransformMode ? 'opacity-50 cursor-not-allowed' : ''}`}>
              📷 Image
              <input
                type="file"
                accept="image/*"
                onChange={handleDesignImageUpload}
                disabled={isTransformMode}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setTool('text')}
              disabled={isTransformMode}
              className={`px-3 py-1 rounded text-sm ${
                tool === 'text' && !isTransformMode ? 'bg-orange-500 text-white' : 'bg-gray-200'
              } ${isTransformMode ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Add Text
            </button>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              disabled={isTransformMode}
              className="w-16 px-2 py-1 border rounded text-sm"
              min="8"
              max="72"
            />
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={isTransformMode}
              placeholder="Text"
              className="flex-1 px-2 py-1 border rounded text-sm"
            />
          </div>

          {isTransformMode && designImage && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded space-y-2">
              <div className="text-xs font-semibold text-blue-800 mb-2">🔧 IMAGE TRANSFORM MODE</div>
              
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-16">Scale:</label>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={imageTransform.scale}
                  onChange={(e) => setImageTransform(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                  className="flex-1"
                />
                <span className="text-xs w-12">{imageTransform.scale.toFixed(1)}x</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 w-16">Rotate:</label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="1"
                  value={imageTransform.rotation}
                  onChange={(e) => setImageTransform(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
                  className="flex-1"
                />
                <span className="text-xs w-12">{imageTransform.rotation}°</span>
              </div>

              <div className="text-xs text-gray-600 mb-1">💡 Drag image on canvas to reposition</div>

              <div className="flex gap-2">
                <button
                  onClick={applyImageToCanvas}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm font-semibold"
                >
                  ✓ Apply
                </button>
                <button
                  onClick={() => {
                    setDesignImage(null);
                    setIsTransformMode(false);
                    initUVCanvas();
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-semibold"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="mb-3 text-center">
            <div className="text-xs font-semibold text-gray-600 mb-2 tracking-wider">UV LAYOUT GUIDE</div>
            <div className="text-xs text-gray-500 mb-2">
              {isTransformMode && "🔧 Transform Mode Active"}
              {!isTransformMode && (uvLayoutImage 
                ? "Drawing on your custom UV layout" 
                : "Loading UV layout...")}
            </div>
          </div>

          <canvas
            ref={uvCanvasRef}
            width="2048"
            height="2048"
            className={`w-full border-2 border-gray-300 rounded bg-white shadow-lg ${
              isTransformMode ? 'cursor-move' : 'cursor-crosshair'
            }`}
            onMouseDown={handleUVMouseDown}
            onMouseMove={handleUVMouseMove}
            onMouseUp={handleUVMouseUp}
            onMouseLeave={handleUVMouseUp}
          />
        </div>
      </div>
    </div>
  );
}