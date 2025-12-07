import React from 'react';
import { TOOLS, COLOR_PRESETS } from '../utils/constants';

export default function Toolbar({
  tool,
  setTool,
  brushSize,
  setBrushSize,
  brushColor,
  setBrushColor,
  fontSize,
  setFontSize,
  textInput,
  setTextInput,
  onImageUpload,
  onClear,
  onUndo,
  onRedo,
  historyIndex,
  historyLength,
  isTransformMode,
  imageTransform,
  setImageTransform,
  onApplyImage,
  onCancelImage,
  isMobile
}) {
  return (
    <div className="p-4">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Панель Инструментов Дизайна</h2>
      
      {/* Кнопки инструментов */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        {[
          { id: TOOLS.DRAW, icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z', label: 'Рисование' },
          { id: TOOLS.ERASE, icon: 'M6 18L18 6M6 6l12 12', label: 'Ластик' },
          { id: TOOLS.TEXT, icon: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129', label: 'Текст' }
        ].map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setTool(id)}
            className={`py-4 px-2 rounded-xl text-xs font-medium transition-all flex flex-col items-center justify-center gap-2 ${
              tool === id
                ? 'bg-blue-500 text-white shadow-lg'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            title={label}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
            </svg>
            <span className="text-xs">{label}</span>
          </button>
        ))}
      </div>

      {!isTransformMode ? (
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-gray-900">Свойства</h3>
          
          {(tool === TOOLS.DRAW || tool === TOOLS.ERASE) && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium text-gray-700">Размер кисти</label>
                <span className="text-xs text-gray-500">{brushSize}px</span>
              </div>
              <input
                type="range"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                min="5"
                max="100"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-700 mb-3 block">Цвет</label>
            <div className="grid grid-cols-10 gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  onClick={() => setBrushColor(color)}
                  className={`w-full aspect-square rounded-lg border-2 transition-all ${
                    brushColor === color 
                      ? 'border-blue-500 ring-2 ring-blue-200 scale-110' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {tool === TOOLS.TEXT && (
            <>
              <div>
                <label className="text-xs font-medium text-gray-700 mb-2 block">Текст</label>
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Введите текст..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-medium text-gray-700">Размер шрифта</label>
                  <span className="text-xs text-gray-500">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  min="24"
                  max="200"
                />
              </div>
            </>
          )}

          <div className="border-t border-gray-200 my-4"></div>

          <div className="space-y-2">
            <button
              onClick={() => document.querySelector('input[type="file"]').click()}
              className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Добавить изображение
              <input
                type="file"
                accept="image/*"
                onChange={onImageUpload}
                className="hidden"
              />
            </button>
            
            <button
              onClick={onClear}
              className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Очистить холст
            </button>

            <div className="border-t border-gray-200 my-3"></div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onUndo}
                disabled={historyIndex <= 0}
                className="py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                title="Отменить последнее действие"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                <span className="text-xs">Отменить</span>
              </button>
              <button
                onClick={onRedo}
                disabled={historyIndex >= historyLength - 1}
                className="py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                title="Повторить последнее действие"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                </svg>
                <span className="text-xs">Повторить</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="text-center py-2 bg-blue-50 rounded-lg border border-blue-200">
            <span className="text-sm font-semibold text-blue-700">🔧 Режим трансформации</span>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-medium text-gray-700">Масштаб</label>
              <span className="text-xs text-gray-500">{imageTransform.scale.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={imageTransform.scale}
              onChange={(e) => setImageTransform(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-medium text-gray-700">Поворот</label>
              <span className="text-xs text-gray-500">{imageTransform.rotation}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={imageTransform.rotation}
              onChange={(e) => setImageTransform(prev => ({ ...prev, rotation: parseInt(e.target.value) }))}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div className="text-xs text-gray-500 text-center bg-gray-50 p-3 rounded-lg">
            {isMobile ? '📱 Перетащите для перемещения • Сведите пальцы для масштабирования' : '🖱️ Перетащите для изменения позиции на холсте'}
          </div>

          <div className="space-y-2">
            <button
              onClick={onApplyImage}
              className="w-full py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all text-sm font-semibold shadow-md"
            >
              ✓ Применить
            </button>
            <button
              onClick={onCancelImage}
              className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm font-semibold"
            >
              ✕ Отменить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}