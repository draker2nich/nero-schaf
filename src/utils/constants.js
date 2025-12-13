// Константы приложения
export const CANVAS_SIZE = 1024; // Уменьшено с 2048 для производительности
export const MODEL_PATH = '/materials/model.glb';
export const UV_LAYOUT_PATH = '/materials/uv-layout.png';

export const COLOR_PRESETS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FF6B35', '#004E89'
];

export const MAX_HISTORY = 20; // Уменьшено для экономии памяти

export const TOOLS = {
  DRAW: 'draw',
  ERASE: 'erase',
  IMAGE: 'image'
};

// Настройки производительности
export const PERFORMANCE = {
  POINTER_THROTTLE_MS: 16, // ~60fps для событий pointer
  TEXTURE_UPDATE_MS: 50, // Обновление 3D текстуры
  MIN_DRAW_DISTANCE: 3, // Минимальное расстояние между точками
  TRANSFORM_THROTTLE_MS: 32 // ~30fps для трансформации изображения
};

// Реэкспорт типов слоёв для удобства
export { LAYER_TYPES } from './layerTypes';