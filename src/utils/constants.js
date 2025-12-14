// Определение мобильного устройства для констант
const isMobile = typeof window !== 'undefined' && (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (window.innerWidth <= 1024 && 'ontouchstart' in window)
);

// Размер canvas - уменьшаем на мобильных для производительности
// 1024 на десктопе, 512 на мобильных
export const CANVAS_SIZE = isMobile ? 512 : 1024;

export const MODEL_PATH = '/materials/model.glb';
export const UV_LAYOUT_PATH = '/materials/uv-layout.png';

export const COLOR_PRESETS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FF6B35', '#004E89'
];

export const MAX_HISTORY = isMobile ? 10 : 20; // Меньше истории на мобильных

export const TOOLS = {
  DRAW: 'draw',
  ERASE: 'erase',
  IMAGE: 'image'
};

// Настройки производительности с учётом мобильных
export const PERFORMANCE = {
  POINTER_THROTTLE_MS: isMobile ? 32 : 16, // ~30fps на мобильных, ~60fps на десктопе
  TEXTURE_UPDATE_MS: isMobile ? 100 : 50, // Реже обновляем текстуру на мобильных
  MIN_DRAW_DISTANCE: isMobile ? 5 : 3, // Больше расстояние между точками на мобильных
  TRANSFORM_THROTTLE_MS: isMobile ? 50 : 32
};

// Реэкспорт типов слоёв для удобства
export { LAYER_TYPES } from './layerTypes';