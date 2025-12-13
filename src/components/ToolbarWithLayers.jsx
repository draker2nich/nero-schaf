import React, { memo, useCallback } from 'react';
import { TOOLS, COLOR_PRESETS } from '../utils/constants';
import LayersPanel from './LayersPanel';

// Иконки
const PencilIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const EraserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const UndoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);

const RedoIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
  </svg>
);

// Кнопка инструмента
const ToolButton = memo(({ id, icon: Icon, label, isActive, onClick, variant }) => {
  const baseClasses = "py-3 px-2 rounded-xl text-xs font-medium transition-all flex flex-col items-center justify-center gap-1.5";
  
  const variants = {
    default: isActive
      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300',
    ai: isActive
      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30'
      : 'bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 hover:from-violet-100 hover:to-purple-100 border border-violet-200'
  };

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variants[variant || 'default']}`}
      aria-label={label}
    >
      <Icon />
      <span className="text-xs">{label}</span>
    </button>
  );
});

// Кнопка цвета
const ColorButton = memo(({ color, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full aspect-square rounded-lg border-2 transition-all ${
      isActive
        ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
        : 'border-gray-300 hover:border-gray-400'
    }`}
    style={{ backgroundColor: color }}
    aria-label={`Цвет ${color}`}
  />
));

// Слайдер размера
const SizeSlider = memo(({ label, value, onChange, min = 5, max = 100 }) => (
  <div>
    <div className="flex justify-between items-center mb-2">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <span className="text-xs text-gray-500 tabular-nums">{value}px</span>
    </div>
    <input
      type="range"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
      min={min}
      max={max}
    />
  </div>
));

// Панель трансформации
const TransformPanel = memo(({ 
  imageTransform, 
  setImageTransform, 
  onApply, 
  onCancel, 
  isMobile 
}) => (
  <div className="space-y-5">
    <div className="text-center py-2 bg-blue-50 rounded-lg border border-blue-200">
      <span className="text-sm font-semibold text-blue-700">Режим трансформации</span>
    </div>

    <SizeSlider
      label="Масштаб"
      value={Math.round(imageTransform.scale * 10)}
      onChange={(v) => setImageTransform(prev => ({ ...prev, scale: v / 10 }))}
      min={1}
      max={30}
    />

    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-medium text-gray-700">Поворот</label>
        <span className="text-xs text-gray-500 tabular-nums">{imageTransform.rotation}°</span>
      </div>
      <input
        type="range"
        min="0"
        max="360"
        step="1"
        value={imageTransform.rotation}
        onChange={(e) => setImageTransform(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>

    <div className="text-xs text-gray-500 text-center bg-gray-50 p-3 rounded-lg">
      {isMobile 
        ? 'Перетащите для перемещения • Сведите пальцы для масштабирования' 
        : 'Перетащите для изменения позиции на холсте'}
    </div>

    <div className="space-y-2">
      <button
        onClick={onApply}
        className="w-full py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 active:bg-green-700 transition-all text-sm font-semibold shadow-md"
      >
        ✓ Применить
      </button>
      <button
        onClick={onCancel}
        className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-all text-sm font-semibold"
      >
        ✕ Отменить
      </button>
    </div>
  </div>
));

function ToolbarWithLayers({
  tool,
  setTool,
  brushSize,
  setBrushSize,
  brushColor,
  setBrushColor,
  onImageUpload,
  onAIGenerate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isTransformMode,
  imageTransform,
  setImageTransform,
  onApplyImage,
  onCancelImage,
  isMobile,
  // Пропсы для слоёв
  layers,
  activeLayerId,
  onSelectLayer,
  onToggleLayerVisibility,
  onMoveLayerUp,
  onMoveLayerDown,
  onDeleteLayer,
  onAddDrawingLayer,
  onClearLayer,
  onClearAll
}) {
  const fileInputRef = React.useRef(null);
  
  const handleImageClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const tools = [
    { id: TOOLS.DRAW, icon: PencilIcon, label: 'Рисование' },
    { id: TOOLS.ERASE, icon: EraserIcon, label: 'Ластик' }
  ];

  if (isTransformMode) {
    return (
      <div className="p-4">
        <TransformPanel
          imageTransform={imageTransform}
          setImageTransform={setImageTransform}
          onApply={onApplyImage}
          onCancel={onCancelImage}
          isMobile={isMobile}
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="space-y-5">
        {/* Панель слоёв */}
        <LayersPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onSelectLayer={onSelectLayer}
          onToggleVisibility={onToggleLayerVisibility}
          onMoveUp={onMoveLayerUp}
          onMoveDown={onMoveLayerDown}
          onDelete={onDeleteLayer}
          onAddDrawingLayer={onAddDrawingLayer}
          onClearLayer={onClearLayer}
          onClearAll={onClearAll}
        />

        <div className="border-t border-gray-200 my-4" />

        <h3 className="text-sm font-semibold text-gray-900">Инструменты</h3>

        {/* Основные инструменты */}
        <div className="grid grid-cols-2 gap-2">
          {tools.map(({ id, icon, label }) => (
            <ToolButton
              key={id}
              id={id}
              icon={icon}
              label={label}
              isActive={tool === id}
              onClick={() => setTool(id)}
            />
          ))}
        </div>

        {/* Секция изображений */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Добавить изображение</h4>
          
          <div className="grid grid-cols-2 gap-2">
            <ToolButton
              id="image"
              icon={ImageIcon}
              label="Загрузить"
              isActive={false}
              onClick={handleImageClick}
            />
            <ToolButton
              id="ai"
              icon={SparklesIcon}
              label="AI Генерация"
              isActive={false}
              onClick={onAIGenerate}
              variant="ai"
            />
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onImageUpload}
          className="hidden"
        />

        <div className="border-t border-gray-200 my-4" />

        <h3 className="text-sm font-semibold text-gray-900">Свойства</h3>

        {tool === TOOLS.DRAW && (
          <>
            <SizeSlider
              label="Размер кисти"
              value={brushSize}
              onChange={setBrushSize}
            />

            <div>
              <label className="text-xs font-medium text-gray-700 mb-3 block">Цвет</label>
              <div className="grid grid-cols-10 gap-1.5">
                {COLOR_PRESETS.map((color) => (
                  <ColorButton
                    key={color}
                    color={color}
                    isActive={brushColor === color}
                    onClick={() => setBrushColor(color)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {tool === TOOLS.ERASE && (
          <SizeSlider
            label="Размер ластика"
            value={brushSize}
            onChange={setBrushSize}
          />
        )}

        <div className="border-t border-gray-200 my-4" />

        {/* Undo/Redo */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
          >
            <UndoIcon />
            <span className="text-xs">Отменить</span>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 active:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
          >
            <RedoIcon />
            <span className="text-xs">Повторить</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ToolbarWithLayers);