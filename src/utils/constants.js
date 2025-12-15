// Определение мобильного устройства для констант
const isMobile = typeof window !== 'undefined' && (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (window.innerWidth <= 1024 && 'ontouchstart' in window)
);

// Размер canvas - уменьшаем на мобильных для производительности
export const CANVAS_SIZE = isMobile ? 512 : 1024;

export const MODEL_PATH = '/materials/model.glb';
export const UV_LAYOUT_PATH = '/materials/uv-layout.png';

// Базовые цвета для быстрого доступа (уменьшено, т.к. есть color picker)
export const COLOR_PRESETS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FF6B35', '#004E89',
  '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#6366F1'
];

export const MAX_HISTORY = isMobile ? 10 : 20;

export const TOOLS = {
  DRAW: 'draw',
  ERASE: 'erase',
  IMAGE: 'image'
};

// Настройки края кисти/ластика
export const BRUSH_HARDNESS = {
  MIN: 0,    // Полностью мягкий край
  MAX: 100,  // Полностью жёсткий край
  DEFAULT: 80
};

// Настройки производительности
export const PERFORMANCE = {
  POINTER_THROTTLE_MS: isMobile ? 32 : 16,
  TEXTURE_UPDATE_MS: isMobile ? 100 : 50,
  MIN_DRAW_DISTANCE: isMobile ? 5 : 3,
  TRANSFORM_THROTTLE_MS: isMobile ? 50 : 32
};

export { LAYER_TYPES } from './layerTypes';