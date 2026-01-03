// Определение мобильного устройства для констант
const isMobile = typeof window !== 'undefined' && (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
  (window.innerWidth <= 1024 && 'ontouchstart' in window)
);

// Размер canvas - уменьшаем на мобильных для производительности
export const CANVAS_SIZE = isMobile ? 512 : 1024;

export const MODEL_PATH = '/materials/model.glb';
export const UV_LAYOUT_PATH = '/materials/uv-layout.png';

// Базовые цвета для быстрого доступа
export const COLOR_PRESETS = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FF6B35', '#004E89',
  '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#6366F1'
];

export const MAX_HISTORY = isMobile ? 10 : 20;

// Расширенный список инструментов
export const TOOLS = {
  DRAW: 'draw',
  ERASE: 'erase',
  STAMP: 'stamp',      // Новый: штамп
  IMAGE: 'image',
  PAN: 'pan'           // Новый: панорамирование
};

// Настройки размера кисти
export const BRUSH_SIZE = {
  MIN: 1,
  MAX: 150,
  DEFAULT: 15
};

// Настройки жёсткости края кисти/ластика
export const BRUSH_HARDNESS = {
  MIN: 0,
  MAX: 100,
  DEFAULT: 80,
  PRESETS: {
    SOFT: 0,
    MEDIUM: 50,
    HARD: 100
  }
};

// Настройки прозрачности кисти (НОВОЕ)
export const BRUSH_OPACITY = {
  MIN: 1,
  MAX: 100,
  DEFAULT: 100
};

// Настройки давления для планшетов (НОВОЕ)
export const PRESSURE_SETTINGS = {
  ENABLED: true,
  MIN_SIZE_MULTIPLIER: 0.1,    // Минимальный размер при нулевом давлении
  MAX_SIZE_MULTIPLIER: 1.0,    // Максимальный размер при полном давлении
  MIN_OPACITY_MULTIPLIER: 0.2, // Минимальная прозрачность при нулевом давлении
  MAX_OPACITY_MULTIPLIER: 1.0, // Максимальная прозрачность при полном давлении
  AFFECTS_SIZE: true,          // Давление влияет на размер
  AFFECTS_OPACITY: true        // Давление влияет на прозрачность
};

// Настройки штампа (НОВОЕ)
export const STAMP_SETTINGS = {
  MIN_SIZE: 10,
  MAX_SIZE: 200,
  DEFAULT_SIZE: 50,
  PREVIEW_OPACITY: 0.5
};

// Настройки зума холста (НОВОЕ)
export const CANVAS_ZOOM = {
  MIN: 0.25,      // 25%
  MAX: 8.0,       // 800%
  DEFAULT: 1.0,   // 100%
  STEP: 0.1,      // Шаг при колёсике мыши
  FIT_PADDING: 20 // Отступ при "Fit to view"
};

// Настройки производительности
export const PERFORMANCE = {
  POINTER_THROTTLE_MS: isMobile ? 32 : 16,
  TEXTURE_UPDATE_MS: isMobile ? 100 : 50,
  MIN_DRAW_DISTANCE: isMobile ? 5 : 3,
  TRANSFORM_THROTTLE_MS: isMobile ? 50 : 32,
  BRUSH_INTERPOLATION_DENSITY: {
    SOFT: 0.15,
    HARD: 0.25
  }
};

export { LAYER_TYPES } from './layerTypes';
