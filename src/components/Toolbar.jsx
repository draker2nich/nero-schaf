import React from 'react';
import { TOOLS, COLOR_PRESETS } from '../utils/constants';

export default function Toolbar({
  tool,
  setTool,
  brushSize,
  setBrushSize,
  brushColor,
  setBrushColor,
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
      {!isTransformMode ? (
        <div className="space-y-5">
          <h3 className="text-sm font-semibold text-gray-900">Инструменты</h3>
          
          {/* Tool buttons */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { id: TOOLS.DRAW, icon: 'fa-pencil-alt', label: 'Рисование' },
              { id: TOOLS.ERASE, icon: 'fa-eraser', label: 'Ластик' },
              { id: TOOLS.IMAGE, icon: 'fa-image', label: 'Изображение' }
            ].map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => id === TOOLS.IMAGE ? document.querySelector('input[type="file"]').click() : setTool(id)}
                className={`py-4 px-2 rounded-xl text-xs font-medium transition-all flex flex-col items-center justify-center gap-2 ${
                  tool === id
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={label}
              >
                <i className={`fas ${icon} text-xl`}></i>
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>

          <input
            type="file"
            accept="image/*"
            onChange={onImageUpload}
            className="hidden"
          />

          <div className="border-t border-gray-200 my-4"></div>

          <h3 className="text-sm font-semibold text-gray-900">Свойства</h3>
          
          {/* Draw tool properties */}
          {tool === TOOLS.DRAW && (
            <>
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
            </>
          )}

          {/* Eraser tool properties */}
          {tool === TOOLS.ERASE && (
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-medium text-gray-700">Размер ластика</label>
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

          <div className="border-t border-gray-200 my-4"></div>

          <div className="space-y-2">
            <button
              onClick={onClear}
              className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
            >
              <i className="fas fa-trash text-sm"></i>
              Очистить холст
            </button>

            <div className="border-t border-gray-200 my-3"></div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onUndo}
                disabled={historyIndex < 0}
                className="py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                title="Отменить последнее действие"
              >
                <i className="fas fa-undo text-lg"></i>
                <span className="text-xs">Отменить</span>
              </button>
              <button
                onClick={onRedo}
                disabled={historyIndex >= historyLength - 1}
                className="py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1"
                title="Повторить последнее действие"
              >
                <i className="fas fa-redo text-lg"></i>
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