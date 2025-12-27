import React, { memo, useCallback, useState, useRef, useMemo, useEffect } from 'react';
import { TOOLS, COLOR_PRESETS, BRUSH_HARDNESS } from '../utils/constants';
import { generateBrushPreview } from '../utils/drawingUtils';
import LayersPanel from './LayersPanel';

// Иконки
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
    <button onClick={onClick} className={`${baseClasses} ${variants[variant || 'default']}`} aria-label={label}>
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
      isActive ? 'border-blue-500 ring-2 ring-blue-200 scale-110' : 'border-gray-300 hover:border-gray-400'
    }`}
    style={{ backgroundColor: color }}
    aria-label={`Цвет ${color}`}
  />
));

// ИСПРАВЛЕННЫЙ Color Picker
const FullColorPicker = memo(({ color, onChange }) => {
  const inputRef = useRef(null);
  const [localColor, setLocalColor] = useState(color);
  
  useEffect(() => { setLocalColor(color); }, [color]);
  
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 0, g: 0, b: 0 };
  };
  
  const rgbToCmyk = (r, g, b) => {
    const rN = r / 255, gN = g / 255, bN = b / 255;
    const k = 1 - Math.max(rN, gN, bN);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    return { c: Math.round((1 - rN - k) / (1 - k) * 100), m: Math.round((1 - gN - k) / (1 - k) * 100), y: Math.round((1 - bN - k) / (1 - k) * 100), k: Math.round(k * 100) };
  };
  
  const rgb = hexToRgb(localColor);
  const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
  
  const updateFromRgb = (r, g, b) => {
    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    setLocalColor(hex);
    onChange(hex);
  };
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12 rounded-xl border-2 border-gray-300 cursor-pointer hover:border-blue-400 shadow-inner overflow-hidden" style={{ backgroundColor: localColor }}>
          <input ref={inputRef} type="color" value={localColor} onChange={(e) => { setLocalColor(e.target.value); onChange(e.target.value); }} className="absolute inset-0 w-full h-full cursor-pointer" style={{ opacity: 0, minWidth: '48px', minHeight: '48px' }} />
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500 block mb-1">HEX</label>
          <input type="text" value={localColor.toUpperCase()} onChange={(e) => { let val = e.target.value; if (!val.startsWith('#')) val = '#' + val; if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) { setLocalColor(val); if (val.length === 7) onChange(val); } }} className="w-full px-2 py-1.5 text-sm font-mono bg-gray-100 border border-gray-300 rounded-lg" maxLength={7} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[{ch: 'r', bg: 'bg-red-50 border-red-200'}, {ch: 'g', bg: 'bg-green-50 border-green-200'}, {ch: 'b', bg: 'bg-blue-50 border-blue-200'}].map(({ch, bg}) => (
          <div key={ch}>
            <label className="text-xs text-gray-500 block mb-1">{ch.toUpperCase()}</label>
            <input type="number" min={0} max={255} value={rgb[ch]} onChange={(e) => { const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0)); const newRgb = {...rgb, [ch]: val}; updateFromRgb(newRgb.r, newRgb.g, newRgb.b); }} className={`w-full px-2 py-1.5 text-sm rounded-lg border ${bg}`} />
          </div>
        ))}
      </div>
      <div className="p-2 bg-gray-50 rounded-lg">
        <label className="text-xs text-gray-500 block mb-1">CMYK (для печати)</label>
        <div className="flex gap-2 text-xs font-mono">
          <span className="px-2 py-1 bg-cyan-100 text-cyan-800 rounded">C:{cmyk.c}%</span>
          <span className="px-2 py-1 bg-pink-100 text-pink-800 rounded">M:{cmyk.m}%</span>
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Y:{cmyk.y}%</span>
          <span className="px-2 py-1 bg-gray-200 text-gray-800 rounded">K:{cmyk.k}%</span>
        </div>
      </div>
    </div>
  );
});

const BrushPreview = memo(({ size, hardness, color, isEraser }) => {
  const previewDataUrl = useMemo(() => generateBrushPreview(64, hardness, isEraser ? '#666666' : color), [hardness, color, isEraser]);
  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
      <span className="text-xs font-medium text-gray-600">Превью кисти</span>
      <div className="relative rounded-lg overflow-hidden border border-gray-300" style={{ width: 64, height: 64 }}>
        <img src={previewDataUrl} alt="Brush preview" className="w-full h-full" style={{ imageRendering: 'auto' }} />
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span>Ø {size}px</span>
        <span>Жёсткость {hardness}%</span>
      </div>
    </div>
  );
});

const SizeSlider = memo(({ label, value, onChange, min = 5, max = 100 }) => {
  const [inputValue, setInputValue] = useState(value.toString());
  useEffect(() => { setInputValue(value.toString()); }, [value]);
  const handleInputChange = useCallback((e) => { const nv = e.target.value; setInputValue(nv); const num = parseInt(nv, 10); if (!isNaN(num) && num >= min && num <= max) onChange(num); }, [onChange, min, max]);
  const handleInputBlur = useCallback(() => { const num = parseInt(inputValue, 10); if (isNaN(num) || num < min) { setInputValue(min.toString()); onChange(min); } else if (num > max) { setInputValue(max.toString()); onChange(max); } }, [inputValue, onChange, min, max]);
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-1">
          <input type="number" value={inputValue} onChange={handleInputChange} onBlur={handleInputBlur} min={min} max={max} className="w-14 px-2 py-1 text-xs text-right bg-gray-100 border border-gray-300 rounded-md" />
          <span className="text-xs text-gray-500">px</span>
        </div>
      </div>
      <input type="range" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" min={min} max={max} />
      <div className="flex justify-between text-xs text-gray-400 mt-1"><span>{min}px</span><span>{max}px</span></div>
    </div>
  );
});

const HardnessSlider = memo(({ value, onChange }) => {
  const [inputValue, setInputValue] = useState(value.toString());
  useEffect(() => { setInputValue(value.toString()); }, [value]);
  const handleInputChange = useCallback((e) => { const nv = e.target.value; setInputValue(nv); const num = parseInt(nv, 10); if (!isNaN(num) && num >= BRUSH_HARDNESS.MIN && num <= BRUSH_HARDNESS.MAX) onChange(num); }, [onChange]);
  const handleInputBlur = useCallback(() => { const num = parseInt(inputValue, 10); if (isNaN(num) || num < BRUSH_HARDNESS.MIN) { setInputValue(BRUSH_HARDNESS.MIN.toString()); onChange(BRUSH_HARDNESS.MIN); } else if (num > BRUSH_HARDNESS.MAX) { setInputValue(BRUSH_HARDNESS.MAX.toString()); onChange(BRUSH_HARDNESS.MAX); } }, [inputValue, onChange]);
  const presets = [{ value: 0, label: 'Мягкая' }, { value: 50, label: 'Средняя' }, { value: 100, label: 'Жёсткая' }];
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-medium text-gray-700">Жёсткость края</label>
        <div className="flex items-center gap-1">
          <input type="number" value={inputValue} onChange={handleInputChange} onBlur={handleInputBlur} min={BRUSH_HARDNESS.MIN} max={BRUSH_HARDNESS.MAX} className="w-14 px-2 py-1 text-xs text-right bg-gray-100 border border-gray-300 rounded-md" />
          <span className="text-xs text-gray-500">%</span>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ background: `radial-gradient(circle, #374151 0%, transparent ${100 - value * 0.3}%)` }} />
        <input type="range" value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 h-2 rounded-lg appearance-none cursor-pointer" min={BRUSH_HARDNESS.MIN} max={BRUSH_HARDNESS.MAX} style={{ background: `linear-gradient(to right, #e5e7eb 0%, #9ca3af ${value}%, #e5e7eb ${value}%, #e5e7eb 100%)` }} />
        <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0" />
      </div>
      <div className="flex gap-1">
        {presets.map((preset) => (<button key={preset.value} onClick={() => onChange(preset.value)} className={`flex-1 py-1.5 text-xs rounded-md transition-all ${value === preset.value ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{preset.label}</button>))}
      </div>
    </div>
  );
});

const TransformPanel = memo(({ imageTransform, setImageTransform, onApply, onCancel, isMobile, qualityInfo }) => (
  <div className="space-y-5">
    <div className="text-center py-2 bg-blue-50 rounded-lg border border-blue-200">
      <span className="text-sm font-semibold text-blue-700">Режим трансформации</span>
    </div>
    {qualityInfo && (
      <div className={`p-3 rounded-lg border ${qualityInfo.status === 'good' ? 'bg-green-50 border-green-200' : qualityInfo.status === 'warning' ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-lg ${qualityInfo.status === 'good' ? 'text-green-500' : qualityInfo.status === 'warning' ? 'text-yellow-500' : 'text-red-500'}`}>
            {qualityInfo.status === 'good' ? '✓' : qualityInfo.status === 'warning' ? '⚠' : '✗'}
          </span>
          <span className={`text-sm font-medium ${qualityInfo.status === 'good' ? 'text-green-700' : qualityInfo.status === 'warning' ? 'text-yellow-700' : 'text-red-700'}`}>{qualityInfo.label}</span>
        </div>
        <p className="text-xs text-gray-600">{qualityInfo.message}</p>
        <div className="mt-2 text-xs text-gray-500">
          <span>Исходник: {qualityInfo.originalWidth}×{qualityInfo.originalHeight}px</span>
          <span className="mx-2">→</span>
          <span>~{qualityInfo.currentDpi} DPI</span>
        </div>
      </div>
    )}
    <SizeSlider label="Масштаб (%)" value={Math.round(imageTransform.scale * 100)} onChange={(v) => setImageTransform(prev => ({ ...prev, scale: v / 100 }))} min={10} max={300} />
    <div>
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-medium text-gray-700">Поворот</label>
        <span className="text-xs text-gray-500 tabular-nums">{imageTransform.rotation}°</span>
      </div>
      <input type="range" min="0" max="360" step="1" value={imageTransform.rotation} onChange={(e) => setImageTransform(prev => ({ ...prev, rotation: parseInt(e.target.value) }))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
    </div>
    <div className="text-xs text-gray-500 text-center bg-gray-50 p-3 rounded-lg">
      {isMobile ? 'Перетащите • Сведите пальцы для масштаба' : 'Перетащите для перемещения'}
    </div>
    <div className="space-y-2">
      <button onClick={onApply} className="w-full py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-semibold shadow-md">✓ Применить</button>
      <button onClick={onCancel} className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold">✕ Отменить</button>
    </div>
  </div>
));

function ToolbarWithLayers({
  tool, setTool, brushSize, setBrushSize, brushColor, setBrushColor,
  brushHardness, setBrushHardness,
  onImageUpload, onAIGenerate, onUndo, onRedo, canUndo, canRedo,
  isTransformMode, imageTransform, setImageTransform, onApplyImage, onCancelImage, isMobile,
  layers, activeLayerId, onSelectLayer, onToggleLayerVisibility,
  onMoveLayerUp, onMoveLayerDown, onDeleteLayer, onAddDrawingLayer, onClearLayer, onClearAll,
  qualityInfo
}) {
  const fileInputRef = useRef(null);
  const [showAllColors, setShowAllColors] = useState(false);
  const [showBrushSettings, setShowBrushSettings] = useState(true);
  const handleImageClick = useCallback(() => { fileInputRef.current?.click(); }, []);
  const tools = [{ id: TOOLS.DRAW, icon: PencilIcon, label: 'Рисование' }, { id: TOOLS.ERASE, icon: EraserIcon, label: 'Ластик' }];

  if (isTransformMode) {
    return (<div className="p-4"><TransformPanel imageTransform={imageTransform} setImageTransform={setImageTransform} onApply={onApplyImage} onCancel={onCancelImage} isMobile={isMobile} qualityInfo={qualityInfo} /></div>);
  }

  return (
    <div className="p-4">
      <div className="space-y-5">
        <LayersPanel layers={layers} activeLayerId={activeLayerId} onSelectLayer={onSelectLayer} onToggleVisibility={onToggleLayerVisibility} onMoveUp={onMoveLayerUp} onMoveDown={onMoveLayerDown} onDelete={onDeleteLayer} onAddDrawingLayer={onAddDrawingLayer} onClearLayer={onClearLayer} onClearAll={onClearAll} />
        <div className="border-t border-gray-200 my-4" />
        <h3 className="text-sm font-semibold text-gray-900">Инструменты</h3>
        <div className="grid grid-cols-2 gap-2">
          {tools.map(({ id, icon, label }) => (<ToolButton key={id} id={id} icon={icon} label={label} isActive={tool === id} onClick={() => setTool(id)} />))}
        </div>
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Добавить изображение</h4>
          <div className="grid grid-cols-2 gap-2">
            <ToolButton id="image" icon={ImageIcon} label="Загрузить" isActive={false} onClick={handleImageClick} />
            <ToolButton id="ai" icon={SparklesIcon} label="AI Генерация" isActive={false} onClick={onAIGenerate} variant="ai" />
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onImageUpload} className="hidden" />
        <div className="border-t border-gray-200 my-4" />
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">{tool === TOOLS.DRAW ? 'Настройки кисти' : 'Настройки ластика'}</h3>
          <button onClick={() => setShowBrushSettings(!showBrushSettings)} className="text-xs text-blue-600 hover:text-blue-800">{showBrushSettings ? 'Свернуть' : 'Развернуть'}</button>
        </div>
        {showBrushSettings && (
          <>
            <BrushPreview size={brushSize} hardness={brushHardness} color={brushColor} isEraser={tool === TOOLS.ERASE} />
            <SizeSlider label={tool === TOOLS.DRAW ? "Радиус кисти" : "Радиус ластика"} value={brushSize} onChange={setBrushSize} min={1} max={150} />
            <HardnessSlider value={brushHardness} onChange={setBrushHardness} />
            {tool === TOOLS.DRAW && (
              <div className="space-y-3">
                <label className="text-xs font-medium text-gray-700 block">Цвет</label>
                <FullColorPicker color={brushColor} onChange={setBrushColor} />
                <div>
                  <button onClick={() => setShowAllColors(!showAllColors)} className="text-xs text-blue-600 hover:text-blue-800 mb-2">{showAllColors ? '▼ Скрыть быстрые цвета' : '▶ Показать быстрые цвета'}</button>
                  {showAllColors && (
                    <div className="grid grid-cols-10 gap-1.5">
                      {COLOR_PRESETS.map((c) => (<ColorButton key={c} color={c} isActive={brushColor === c} onClick={() => setBrushColor(c)} />))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div className="border-t border-gray-200 my-4" />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onUndo} disabled={!canUndo} className="py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"><UndoIcon /><span className="text-xs">Отменить</span></button>
          <button onClick={onRedo} disabled={!canRedo} className="py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"><RedoIcon /><span className="text-xs">Повторить</span></button>
        </div>
      </div>
    </div>
  );
}

export default memo(ToolbarWithLayers);