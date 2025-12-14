import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { isMobileDevice } from './sceneSetup';

// Синглтон загрузчика для переиспользования
let loaderInstance = null;

function getLoader() {
  if (!loaderInstance) {
    loaderInstance = new GLTFLoader();
  }
  return loaderInstance;
}

/**
 * Загрузка 3D модели с оптимизацией для мобильных устройств
 */
export function loadModel(modelPath, uvCanvas, onSuccess, onError) {
  const loader = getLoader();
  const isMobile = isMobileDevice();

  console.log(`[ModelLoader] Loading model: ${modelPath}, mobile: ${isMobile}`);

  loader.load(
    modelPath,
    (gltf) => {
      const loadedModel = gltf.scene;
      
      // Создание текстуры из UV canvas с оптимизацией для мобильных
      const texture = new THREE.CanvasTexture(uvCanvas);
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      
      // Упрощённые настройки фильтрации для мобильных
      if (isMobile) {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false; // Отключаем mipmaps на мобильных
        texture.anisotropy = 1;
      } else {
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;
        texture.anisotropy = 4;
      }

      let firstMesh = null;

      // Применение материала ко всем мешам
      loadedModel.traverse((child) => {
        if (child.isMesh) {
          // Очистка старого материала
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
          
          // Упрощённый материал для мобильных устройств
          if (isMobile) {
            child.material = new THREE.MeshLambertMaterial({
              map: texture,
              side: THREE.DoubleSide,
              color: 0xffffff,
            });
            child.castShadow = false;
            child.receiveShadow = false;
          } else {
            child.material = new THREE.MeshStandardMaterial({
              map: texture,
              side: THREE.DoubleSide,
              metalness: 0.05,
              roughness: 0.7,
              color: 0xffffff,
            });
            child.castShadow = true;
            child.receiveShadow = true;
          }
          
          // Упрощаем геометрию если слишком сложная
          if (child.geometry) {
            child.geometry.computeBoundingBox();
            child.geometry.computeBoundingSphere();
            
            // Удаляем ненужные атрибуты на мобильных
            if (isMobile) {
              // Оставляем только необходимые атрибуты
              const attrs = child.geometry.attributes;
              const keepAttrs = ['position', 'normal', 'uv'];
              Object.keys(attrs).forEach(name => {
                if (!keepAttrs.includes(name)) {
                  child.geometry.deleteAttribute(name);
                }
              });
            }
          }
          
          if (!firstMesh) firstMesh = child;
        }
      });

      // Центрирование и масштабирование модели
      const box = new THREE.Box3().setFromObject(loadedModel);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      
      loadedModel.position.sub(center);
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2 / maxDim;
      loadedModel.scale.multiplyScalar(scale);

      console.log('[ModelLoader] Model loaded successfully');
      onSuccess(loadedModel, texture, firstMesh);
    },
    // Прогресс загрузки
    (progress) => {
      if (progress.lengthComputable) {
        const percent = (progress.loaded / progress.total * 100).toFixed(0);
        console.log(`[ModelLoader] Loading: ${percent}%`);
      }
    },
    (error) => {
      console.error('[ModelLoader] Error loading model:', error);
      onError(error);
    }
  );
}

/**
 * Позиционирование камеры для просмотра модели
 */
export function positionCamera(camera, controls) {
  const fov = camera.fov * (Math.PI / 180);
  const cameraZ = Math.abs(2 / Math.tan(fov / 2)) * 1.5;

  camera.position.set(0, 0.5, cameraZ);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
}