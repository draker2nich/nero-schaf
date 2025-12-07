import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Синглтон загрузчика для переиспользования
let loaderInstance = null;

function getLoader() {
  if (!loaderInstance) {
    loaderInstance = new GLTFLoader();
  }
  return loaderInstance;
}

/**
 * Загрузка 3D модели
 */
export function loadModel(modelPath, uvCanvas, onSuccess, onError) {
  const loader = getLoader();

  loader.load(
    modelPath,
    (gltf) => {
      const loadedModel = gltf.scene;
      
      // Создание текстуры из UV canvas
      const texture = new THREE.CanvasTexture(uvCanvas);
      texture.flipY = false;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 4;

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
          
          child.material = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide,
            metalness: 0.05,
            roughness: 0.7,
            color: 0xffffff,
          });
          
          child.castShadow = true;
          child.receiveShadow = true;
          
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

      onSuccess(loadedModel, texture, firstMesh);
    },
    // Прогресс загрузки (можно использовать для индикатора)
    undefined,
    (error) => {
      console.error('Ошибка загрузки модели:', error);
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