import React, { memo, useCallback, useState, useRef, useMemo, useEffect } from 'react';
import { TOOLS, COLOR_PRESETS, BRUSH_HARDNESS, BRUSH_OPACITY, CANVAS_ZOOM } from '../utils/constants';
import { generateBrushPreview } from '../utils/drawingUtils';
import LayersPanel from './LayersPanel';

// === ИКОНКИ ===
const PencilIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const EraserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const StampIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
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

const ZoomInIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
  </svg>
);

const ZoomOutIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
  </svg>
);

const FitIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
  </svg>
);

// === КОМПОНЕНТЫ ===

const ToolButton = memo(({ id, icon: Icon, label, isActive, onClick, variant, badge }) => {
  const baseClasses = "py-3 px-2 rounded-xl text-xs font-medium transition-all flex flex-col items-center justify-center gap-1.5 relative";
  const variants = {
    default: isActive
      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300',
    ai: isActive
      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30'
      : 'bg-gradient-to-r from-violet-50 to-purple-50 text-violet-700 hover:from-violet-100 hover:to-purple-100 border border-violet-200'
  };
  return (
    <button onClick={onClick} className={`${baseClasses} ${variants[variant || 'default']}`} aria-label={label}>
      <Icon />
      <span className="text-xs">{label}</span>
      {badge && (
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
          {badge}
        </span>
      )}
    </button>
  );
});

const ColorButton = memo(({ color, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full aspect-square rounded-lg border-2 transition-all ${
      isActive ? 'border-blue-500 ring-2 ring-blue-200 scale-110' : 'border-gray-300 hover:border-gray-400'
    }`}
    style={{ backgroundColor: color }}
  />
));

// Слайдер с числовым вводом
const SliderWithInput = memo(({ label, value, onChange, min, max, unit = '' }) => {
  const [inputValue, setInputValue] = useState(value.toString());
  useEffect(() => { setInputValue(value.toString()); }, [value]);
  
  const handleInputChange = (e) => {
    const nv = e.target.value;
    setInputValue(nv);
    const num = parseInt(nv, 10);
    if (!isNaN(num) && num >= min && num <= max) onChange(num);
  };
  
  const handleInputBlur = () => {
    const num = parseInt(inputValue, 10);
    if (isNaN(num) || num < min) { setInputValue(min.toString()); onChange(min); }
    else if (num > max) { setInputValue(max.toString()); onChange(max); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-1">
          <input type="number" value={inputValue} onChange={handleInputChange} onBlur={handleInputBlur} min={min} max={max} className="w-14 px-2 py-1 text-xs text-right bg-gray-100 border border-gray-300 rounded-md" />
          {unit && <span className="text-xs text-gray-500">{unit}</span>}
        </div>
      </div>
      <input type="range" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" min={min} max={max} />
    </div>
  );
});

// Панель зума
const ZoomPanel = memo(({ zoom, onZoomIn, onZoomOut, onFitToView, onResetZoom }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-gray-700">Масштаб</span>
      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{Math.round(zoom * 100)}%</span>
    </div>
    <div className="flex gap-1">
      <button onClick={onZoomOut} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center" title="Уменьшить">
        <ZoomOutIcon />
      </button>
      <button onClick={onResetZoom} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-xs font-medium" title="100%">
        100%
      </button>
      <button onClick={onZoomIn} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center" title="Увеличить">
        <ZoomInIcon />
      </button>
      <button onClick={onFitToView} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center justify-center" title="По размеру">
        <FitIcon />
      </button>
    </div>
    <p className="text-[10px] text-gray-400 text-center">Колёсико мыши для зума • Пробел + перетаскивание для панорамирования</p>
  </div>
));

// Превью кисти
const BrushPreview = memo(({ size, hardness, opacity, color, isEraser }) => {
  const previewDataUrl = useMemo(() => generateBrushPreview(64, hardness, isEraser ? '#666666' : color), [hardness, color, isEraser]);
  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
      <span className="text-xs font-medium text-gray-600">Превью</span>
      <div className="relative rounded-lg overflow-hidden border border-gray-300" style={{ width: 64, height: 64, opacity: opacity / 100 }}>
        <img src={previewDataUrl} alt="Brush preview" className="w-full h-full" />
      </div>
      <div className="flex gap-3 text-xs text-gray-500">
        <span>Ø{size}px</span>
        <span>{hardness}%</span>
        <span>{opacity}%</span>
      </div>
    </div>
  );
});

// Color Picker
const FullColorPicker = memo(({ color, onChange }) => {
  const inputRef = useRef(null);
  const [localColor, setLocalColor] = useState(color);
  useEffect(() => { setLocalColor(color); }, [color]);
  
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
  };
  
  const rgb = hexToRgb(localColor);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-lg border-2 border-gray-300 cursor-pointer overflow-hidden" style={{ backgroundColor: localColor }}>
          <input ref={inputRef} type="color" value={localColor} onChange={(e) => { setLocalColor(e.target.value); onChange(e.target.value); }} className="absolute inset-0 w-full h-full cursor-pointer opacity-0" />
        </div>
        <input type="text" value={localColor.toUpperCase()} onChange={(e) => { let val = e.target.value; if (!val.startsWith('#')) val = '#' + val; if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) { setLocalColor(val); if (val.length === 7) onChange(val); } }} className="flex-1 px-2 py-1.5 text-sm font-mono bg-gray-100 border border-gray-300 rounded-lg" maxLength={7} />
      </div>
    </div>
  );
});

// Настройки штампа
const StampSettings = memo(({ hasSource, sourcePoint }) => (
  <div className={`p-3 rounded-lg border ${hasSource ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
    <div className="flex items-center gap-2">
      <span className={`text-lg ${hasSource ? 'text-green-500' : 'text-yellow-500'}`}>
        {hasSource ? '✓' : '⚠'}
      </span>
      <div>
        <p className="text-sm font-medium text-gray-700">
          {hasSource ? 'Источник установлен' : 'Источник не установлен'}
        </p>
        <p className="text-xs text-gray-500">
          {hasSource 
            ? `Позиция: ${Math.round(sourcePoint?.x || 0)}, ${Math.round(sourcePoint?.y || 0)}`
            : 'Alt+Click на холсте для выбора области'}
        </p>
      </div>
    </div>
  </div>
));

// === ГЛАВНЫЙ КОМПОНЕНТ ===

function ToolbarWithLayers({
  tool, setTool, brushSize, setBrushSize, brushColor, setBrushColor,
  brushHardness, setBrushHardness, brushOpacity, setBrushOpacity,
  onImageUpload, onAIGenerate, onUndo, onRedo, canUndo, canRedo,
  isTransformMode, imageTransform, setImageTransform, onApplyImage, onCancelImage, isMobile,
  layers, activeLayerId, onSelectLayer, onToggleLayerVisibility,
  onMoveLayerUp, onMoveLayerDown, onDeleteLayer, onAddDrawingLayer, onClearLayer, onClearAll,
  qualityInfo,
  // Новые пропсы для зума
  viewport, onZoomIn, onZoomOut, onFitToView, onResetZoom,
  // Штамп
  stampSourceSet, stampSourcePoint
}) {
  const fileInputRef = useRef(null);
  const [showBrushSettings, setShowBrushSettings] = useState(true);
  const [showColors, setShowColors] = useState(false);

  const tools = [
    { id: TOOLS.DRAW, icon: PencilIcon, label: 'Кисть' },
    { id: TOOLS.ERASE, icon: EraserIcon, label: 'Ластик' },
    { id: TOOLS.STAMP, icon: StampIcon, label: 'Штамп' }
  ];

  // Режим трансформации изображения
  if (isTransformMode) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-center py-2 bg-blue-50 rounded-lg border border-blue-200">
          <span className="text-sm font-semibold text-blue-700">Режим трансформации</span>
        </div>
        {qualityInfo && (
          <div className={`p-3 rounded-lg border ${qualityInfo.status === 'good' ? 'bg-green-50 border-green-200' : qualityInfo.status === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-sm font-medium">{qualityInfo.label}</p>
            <p className="text-xs text-gray-600">{qualityInfo.message}</p>
          </div>
        )}
        <SliderWithInput label="Масштаб" value={Math.round(imageTransform.scale * 100)} onChange={(v) => setImageTransform(prev => ({ ...prev, scale: v / 100 }))} min={10} max={300} unit="%" />
        <SliderWithInput label="Поворот" value={imageTransform.rotation} onChange={(v) => setImageTransform(prev => ({ ...prev, rotation: v }))} min={0} max={360} unit="°" />
        <div className="space-y-2">
          <button onClick={onApplyImage} className="w-full py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-semibold">✓ Применить</button>
          <button onClick={onCancelImage} className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold">✕ Отменить</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Слои */}
      <LayersPanel layers={layers} activeLayerId={activeLayerId} onSelectLayer={onSelectLayer} onToggleVisibility={onToggleLayerVisibility} onMoveUp={onMoveLayerUp} onMoveDown={onMoveLayerDown} onDelete={onDeleteLayer} onAddDrawingLayer={onAddDrawingLayer} onClearLayer={onClearLayer} onClearAll={onClearAll} />
      
      <div className="border-t border-gray-200" />
      
      {/* Зум */}
      {viewport && (
        <>
          <ZoomPanel zoom={viewport.zoom} onZoomIn={onZoomIn} onZoomOut={onZoomOut} onFitToView={onFitToView} onResetZoom={onResetZoom} />
          <div className="border-t border-gray-200" />
        </>
      )}
      
      {/* Инструменты рисования */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Инструменты</h3>
        <div className="grid grid-cols-3 gap-2">
          {tools.map(({ id, icon, label }) => (
            <ToolButton key={id} id={id} icon={icon} label={label} isActive={tool === id} onClick={() => setTool(id)} />
          ))}
        </div>
      </div>

      {/* Добавить изображение */}
      <div className="grid grid-cols-2 gap-2">
        <ToolButton id="image" icon={ImageIcon} label="Загрузить" onClick={() => fileInputRef.current?.click()} />
        <ToolButton id="ai" icon={SparklesIcon} label="AI" onClick={onAIGenerate} variant="ai" />
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageUpload} className="hidden" />

      <div className="border-t border-gray-200" />

      {/* Настройки штампа */}
      {tool === TOOLS.STAMP && (
        <StampSettings hasSource={stampSourceSet} sourcePoint={stampSourcePoint} />
      )}

      {/* Настройки кисти */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">
            {tool === TOOLS.DRAW ? 'Кисть' : tool === TOOLS.ERASE ? 'Ластик' : 'Штамп'}
          </h3>
          <button onClick={() => setShowBrushSettings(!showBrushSettings)} className="text-xs text-blue-600">
            {showBrushSettings ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        
        {showBrushSettings && (
          <div className="space-y-3">
            <BrushPreview size={brushSize} hardness={brushHardness} opacity={brushOpacity || 100} color={brushColor} isEraser={tool === TOOLS.ERASE} />
            
            <SliderWithInput label="Размер" value={brushSize} onChange={setBrushSize} min={1} max={150} unit="px" />
            <SliderWithInput label="Жёсткость" value={brushHardness} onChange={setBrushHardness} min={0} max={100} unit="%" />
            <SliderWithInput label="Прозрачность" value={brushOpacity || 100} onChange={setBrushOpacity} min={1} max={100} unit="%" />
            
            {tool === TOOLS.DRAW && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-700">Цвет</label>
                <FullColorPicker color={brushColor} onChange={setBrushColor} />
                <button onClick={() => setShowColors(!showColors)} className="text-xs text-blue-600">
                  {showColors ? '▼ Скрыть палитру' : '▶ Быстрые цвета'}
                </button>
                {showColors && (
                  <div className="grid grid-cols-10 gap-1">
                    {COLOR_PRESETS.map((c) => (
                      <ColorButton key={c} color={c} isActive={brushColor === c} onClick={() => setBrushColor(c)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200" />

      {/* Undo/Redo */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={onUndo} disabled={!canUndo} className="py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
          <UndoIcon /> Отменить
        </button>
        <button onClick={onRedo} disabled={!canRedo} className="py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
          <RedoIcon /> Повторить
        </button>
      </div>
    </div>
  );
}

export default memo(ToolbarWithLayers);
