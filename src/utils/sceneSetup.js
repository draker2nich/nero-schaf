import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

// Кэш для градиентного фона
let cachedBackground = null;

/**
 * Определение мобильного устройства
 */
export function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 1024 && 'ontouchstart' in window);
}

/**
 * Получение безопасного pixel ratio для устройства
 */
export function getSafePixelRatio() {
  const dpr = window.devicePixelRatio || 1;
  // На мобильных ограничиваем до 1.5, на десктопе до 2
  // Высокие значения (3-4) вызывают проблемы с WebGL на многих устройствах
  // Минимальное значение 1 для устройств с низким DPR
  const maxDpr = isMobileDevice() ? 1.5 : 2;
  return Math.max(1, Math.min(dpr, maxDpr));
}

export function createGradientBackground() {
  if (cachedBackground) return cachedBackground;
  
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#1a1a1a');
  gradient.addColorStop(1, '#2d2d2d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 2, 512);
  
  cachedBackground = new THREE.CanvasTexture(canvas);
  return cachedBackground;
}

export function setupCamera(container) {
  const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1, // Увеличено с 0.001 для лучшей точности на мобильных
    100  // Уменьшено с 1000 для экономии ресурсов
  );
  camera.position.set(0, 2, 5);
  return camera;
}

export function setupRenderer(container) {
  // Проверяем поддержку WebGL
  const testCanvas = document.createElement('canvas');
  const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
  
  if (!gl) {
    console.error('WebGL не поддерживается на этом устройстве');
    return null;
  }
  
  const isMobile = isMobileDevice();
  const pixelRatio = getSafePixelRatio();
  
  console.log(`[Three.js] Device: ${isMobile ? 'Mobile' : 'Desktop'}, PixelRatio: ${pixelRatio}, Original DPR: ${window.devicePixelRatio}`);
  
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ 
      antialias: !isMobile,
      alpha: false,
      powerPreference: isMobile ? 'low-power' : 'high-performance',
      stencil: false,
      depth: true,
      preserveDrawingBuffer: false,
      failIfMajorPerformanceCaveat: false
    });
  } catch (e) {
    console.error('Ошибка создания WebGL renderer:', e);
    return null;
  }
  
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(pixelRatio);
  
  if (isMobile) {
    renderer.shadowMap.enabled = false;
    renderer.toneMapping = THREE.NoToneMapping;
  } else {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
  }
  
  if (isMobile) {
    const maxTextureSize = Math.min(renderer.capabilities.maxTextureSize, 2048);
    console.log(`[Three.js] Max texture size: ${maxTextureSize}`);
  }
  
  return renderer;
} 

/**
 * Добавление обработчиков потери/восстановления WebGL контекста
 */
export function setupContextHandlers(renderer, onContextLost, onContextRestored) {
  if (!renderer || !renderer.domElement) return;
  
  const canvas = renderer.domElement;
  
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    console.warn('[Three.js] WebGL context lost');
    if (onContextLost) onContextLost();
  }, false);
  
  canvas.addEventListener('webglcontextrestored', () => {
    console.log('[Three.js] WebGL context restored');
    if (onContextRestored) onContextRestored();
  }, false);
}

export function setupControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 0.5;
  controls.maxDistance = 20;
  controls.maxPolarAngle = Math.PI * 0.9;
  
  // Улучшенные настройки для мобильных тач-событий
  controls.touches = {
    ONE: THREE.TOUCH.ROTATE,
    TWO: THREE.TOUCH.DOLLY_PAN
  };
  
  // Включаем тач-поддержку
  controls.enablePan = true;
  controls.enableZoom = true;
  controls.enableRotate = true;
  
  return controls;
}

export function setupLights(scene, isMobile = false) {
  // Ambient - увеличиваем для мобильных (компенсация отсутствия теней)
  const ambientIntensity = isMobile ? 0.8 : 0.5;
  const ambientLight = new THREE.AmbientLight(0xffffff, ambientIntensity);
  scene.add(ambientLight);

  // Key light
  const keyLight = new THREE.DirectionalLight(0xffffff, isMobile ? 1.0 : 1.5);
  keyLight.position.set(3, 4, 3);
  
  if (!isMobile) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 20;
  }
  scene.add(keyLight);

  // Fill light
  const fillLight = new THREE.DirectionalLight(0xffffff, isMobile ? 0.4 : 0.6);
  fillLight.position.set(-3, 2, 3);
  scene.add(fillLight);

  // Back light
  const backLight = new THREE.DirectionalLight(0xffffff, isMobile ? 0.5 : 0.8);
  backLight.position.set(0, 3, -3);
  scene.add(backLight);

  // Accent lights - только для десктопа
  if (!isMobile) {
    const accentLight1 = new THREE.PointLight(0x4488ff, 0.3, 10);
    accentLight1.position.set(-2, 1, -2);
    scene.add(accentLight1);

    const accentLight2 = new THREE.PointLight(0xff8844, 0.2, 10);
    accentLight2.position.set(2, 1, -2);
    scene.add(accentLight2);
  }
}

export function setupGround(scene, isMobile = false) {
  // Пропускаем тени на мобильных
  if (isMobile) return;
  
  const groundGeometry = new THREE.PlaneGeometry(20, 20);
  const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.15 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  ground.receiveShadow = true;
  scene.add(ground);
}

/**
 * Очистка ресурсов сцены
 */
export function disposeScene(scene, renderer) {
  if (scene) {
    scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(mat => disposeMaterial(mat));
        } else {
          disposeMaterial(object.material);
        }
      }
    });
  }
  
  if (renderer) {
    renderer.dispose();
    // Не вызываем forceContextLoss - это может мешать другим вкладкам
    // renderer.forceContextLoss();
  }
  
  // Очищаем кэш фона
  if (cachedBackground) {
    cachedBackground.dispose();
    cachedBackground = null;
  }
}

function disposeMaterial(material) {
  if (material.map) material.map.dispose();
  if (material.lightMap) material.lightMap.dispose();
  if (material.bumpMap) material.bumpMap.dispose();
  if (material.normalMap) material.normalMap.dispose();
  if (material.specularMap) material.specularMap.dispose();
  if (material.envMap) material.envMap.dispose();
  material.dispose();
}