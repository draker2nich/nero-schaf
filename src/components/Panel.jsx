import React, { memo, useCallback } from 'react';

const LAYER_TYPES = {
  BASE: 'base',
  DRAWING: 'drawing',
  IMAGE: 'image'
};

// Иконки
const EyeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const ImageIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const BaseLayerIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
  </svg>
);

const LockIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

// Иконка типа слоя
const LayerTypeIcon = memo(({ type }) => {
  switch (type) {
    case LAYER_TYPES.BASE:
      return <BaseLayerIcon />;
    case LAYER_TYPES.DRAWING:
      return <PencilIcon />;
    case LAYER_TYPES.IMAGE:
      return <ImageIcon />;
    default:
      return null;
  }
});

// Компонент одного слоя
const LayerItem = memo(({ 
  layer, 
  isActive, 
  isFirst, 
  isLast, 
  onSelect, 
  onToggleVisibility, 
  onMoveUp, 
  onMoveDown, 
  onDelete 
}) => {
  const handleSelect = useCallback(() => {
    onSelect(layer.id);
  }, [layer.id, onSelect]);

  const handleToggleVisibility = useCallback((e) => {
    e.stopPropagation();
    onToggleVisibility(layer.id);
  }, [layer.id, onToggleVisibility]);

  const handleMoveUp = useCallback((e) => {
    e.stopPropagation();
    onMoveUp(layer.id);
  }, [layer.id, onMoveUp]);

  const handleMoveDown = useCallback((e) => {
    e.stopPropagation();
    onMoveDown(layer.id);
  }, [layer.id, onMoveDown]);

  const handleDelete = useCallback((e) => {
    e.stopPropagation();
    onDelete(layer.id);
  }, [layer.id, onDelete]);

  return (
    <div 
      onClick={handleSelect}
      className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
        isActive 
          ? 'bg-blue-50 border-2 border-blue-400' 
          : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
      }`}
    >
      {/* Иконка типа */}
      <div className={`p-1.5 rounded-md ${
        layer.type === LAYER_TYPES.BASE 
          ? 'bg-purple-100 text-purple-600'
          : layer.type === LAYER_TYPES.DRAWING 
            ? 'bg-blue-100 text-blue-600'
            : 'bg-green-100 text-green-600'
      }`}>
        <LayerTypeIcon type={layer.type} />
      </div>

      {/* Название */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={`text-sm font-medium truncate ${
            !layer.visible ? 'text-gray-400' : 'text-gray-800'
          }`}>
            {layer.name}
          </span>
          {layer.locked && (
            <span className="text-gray-400">
              <LockIcon />
            </span>
          )}
        </div>
      </div>

      {/* Кнопки управления */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Видимость */}
        <button
          onClick={handleToggleVisibility}
          className={`p-1.5 rounded-md transition-colors ${
            layer.visible 
              ? 'text-gray-600 hover:bg-gray-200' 
              : 'text-gray-300 hover:bg-gray-200'
          }`}
          title={layer.visible ? 'Скрыть' : 'Показать'}
        >
          {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>

        {/* Вверх */}
        {!isLast && (
          <button
            onClick={handleMoveUp}
            className="p-1.5 rounded-md text-gray-600 hover:bg-gray-200 transition-colors"
            title="Поднять выше"
          >
            <ChevronUpIcon />
          </button>
        )}

        {/* Вниз */}
        {!isFirst && layer.type !== LAYER_TYPES.BASE && (
          <button
            onClick={handleMoveDown}
            className="p-1.5 rounded-md text-gray-600 hover:bg-gray-200 transition-colors"
            title="Опустить ниже"
          >
            <ChevronDownIcon />
          </button>
        )}

        {/* Удалить */}
        {!layer.locked && (
          <button
            onClick={handleDelete}
            className="p-1.5 rounded-md text-gray-600 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="Удалить"
          >
            <TrashIcon />
          </button>
        )}
      </div>
    </div>
  );
});

function LayersPanel({
  layers,
  activeLayerId,
  onSelectLayer,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onDelete,
  onAddDrawingLayer,
  onClearLayer,
  onClearAll
}) {
  // Отображаем слои в обратном порядке (верхние сверху)
  const reversedLayers = [...layers].reverse();

  return (
    <div className="space-y-3">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Слои</h3>
        <button
          onClick={onAddDrawingLayer}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          title="Добавить слой"
        >
          <PlusIcon />
          <span>Слой</span>
        </button>
      </div>

      {/* Список слоёв */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {reversedLayers.map((layer, index) => (
          <LayerItem
            key={layer.id}
            layer={layer}
            isActive={layer.id === activeLayerId}
            isFirst={index === reversedLayers.length - 1}
            isLast={index === 0}
            onSelect={onSelectLayer}
            onToggleVisibility={onToggleVisibility}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Кнопки очистки */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={onClearLayer}
          className="flex-1 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Очистить слой
        </button>
        <button
          onClick={onClearAll}
          className="flex-1 py-2 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
        >
          Очистить всё
        </button>
      </div>
    </div>
  );
}

export default memo(LayersPanel);