import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export function loadModel(modelPath, uvCanvas, onSuccess, onError) {
  const loader = new GLTFLoader();

  loader.load(
    modelPath,
    (gltf) => {
      const loadedModel = gltf.scene;
      
      // Создание текстуры из UV canvas
      const texture = new THREE.CanvasTexture(uvCanvas);
      texture.flipY = false;

      let firstMesh = null;

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
    undefined,
    onError
  );
}

export function positionCamera(camera, controls) {
  const fov = camera.fov * (Math.PI / 180);
  const cameraZ = Math.abs(2 / Math.tan(fov / 2)) * 1.5;

  camera.position.set(0, 0.5, cameraZ);
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
}