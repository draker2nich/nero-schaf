import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { 
  generateImages, 
  loadImageFromDataUrl, 
  STYLE_PRESETS, 
  ASPECT_RATIOS,
  applyStyleToPrompt,
  validateApiKey 
} from '../services/aiImageService';

// Константа для localStorage
const API_KEY_STORAGE = 'gemini_api_key';

// Иконки
const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const KeyIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// Компонент кнопки стиля
const StyleButton = memo(({ style, isActive, onClick }) => (
  <button
    onClick={() => onClick(style.id)}
    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
      isActive
        ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    <span>{style.icon}</span>
    <span>{style.name}</span>
  </button>
));

// Компонент выбора соотношения сторон
const AspectRatioSelector = memo(({ value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {ASPECT_RATIOS.map(ratio => (
      <button
        key={ratio.id}
        onClick={() => onChange(ratio.id)}
        className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
          value === ratio.id
            ? 'bg-violet-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        title={ratio.desc}
      >
        {ratio.name}
      </button>
    ))}
  </div>
));

// Компонент выбора количества
const CountSelector = memo(({ value, onChange }) => (
  <div className="flex gap-1.5">
    {[2, 3, 4, 5, 6].map(n => (
      <button
        key={n}
        onClick={() => onChange(n)}
        className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
          value === n
            ? 'bg-violet-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {n}
      </button>
    ))}
  </div>
));

// Компонент сетки изображений
const ImageGrid = memo(({ images, selectedIndex, onSelect, isLoading, count }) => {
  const placeholders = Array.from({ length: count }, (_, i) => i);
  
  return (
    <div className={`grid gap-2 ${count <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {placeholders.map(i => {
        const image = images.find(img => img.index === i);
        const isSelected = selectedIndex === i;
        
        return (
          <div 
            key={i}
            onClick={() => image && onSelect(i)}
            className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all ${
              image 
                ? isSelected 
                  ? 'ring-3 ring-violet-500 ring-offset-2' 
                  : 'hover:ring-2 hover:ring-violet-300'
                : 'bg-gray-100'
            }`}
          >
            {image ? (
              <>
                <img src={image.dataUrl} alt={`Generated ${i + 1}`} className="w-full h-full object-cover" />
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center">
                    <CheckIcon />
                  </div>
                )}
              </>
            ) : isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                <span className="text-2xl">{i + 1}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// Компонент настройки API ключа
const ApiKeySetup = memo(({ apiKey, onApiKeyChange, onValidate, isValidating, isValid }) => {
  const [showKey, setShowKey] = useState(false);
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <KeyIcon />
        <span className="text-sm font-medium text-gray-700">Google AI API Key</span>
        {isValid && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Подключен</span>}
      </div>
      
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="Введите API ключ..."
            className="w-full px-3 py-2 pr-20 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-700"
          >
            {showKey ? 'Скрыть' : 'Показать'}
          </button>
        </div>
        <button
          onClick={onValidate}
          disabled={!apiKey || isValidating}
          className="px-4 py-2 bg-violet-500 text-white text-sm rounded-lg hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isValidating ? '...' : 'Проверить'}
        </button>
      </div>
      
      <p className="text-xs text-gray-500">
        Получите ключ на{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
          aistudio.google.com
        </a>
      </p>
    </div>
  );
});

function AIGenerationModal({ isOpen, onClose, onImageGenerated }) {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('none');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageCount, setImageCount] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [error, setError] = useState(null);
  
  // API Key state
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem(API_KEY_STORAGE) || '';
    } catch {
      return '';
    }
  });
  const [isKeyValid, setIsKeyValid] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Сохранение API ключа
  useEffect(() => {
    if (apiKey) {
      try {
        localStorage.setItem(API_KEY_STORAGE, apiKey);
      } catch {}
    }
  }, [apiKey]);

  // Фокус на инпут при открытии
  useEffect(() => {
    if (isOpen && inputRef.current && isKeyValid) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isKeyValid]);

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Проверка ключа при открытии
  useEffect(() => {
    if (isOpen && apiKey && !isKeyValid) {
      handleValidateKey();
    }
  }, [isOpen]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === modalRef.current) onClose();
  }, [onClose]);

  const handleValidateKey = useCallback(async () => {
    if (!apiKey) return;
    
    setIsValidating(true);
    const result = await validateApiKey(apiKey);
    setIsKeyValid(result.valid);
    setIsValidating(false);
    
    if (!result.valid) {
      setError(result.error);
    } else {
      setError(null);
    }
  }, [apiKey]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating || !isKeyValid) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setSelectedImageIndex(null);

    try {
      const fullPrompt = applyStyleToPrompt(prompt, selectedStyle);
      const result = await generateImages(fullPrompt, {
        apiKey,
        count: imageCount,
        aspectRatio
      });
      
      setGeneratedImages(result.images);
      if (result.images.length > 0) {
        setSelectedImageIndex(0);
      }
      
      if (result.errors) {
        console.warn('Some images failed:', result.errors);
      }
    } catch (err) {
      setError(err.message || 'Ошибка генерации');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, selectedStyle, aspectRatio, imageCount, isGenerating, isKeyValid, apiKey]);

  const handleApply = useCallback(async () => {
    if (selectedImageIndex === null) return;
    
    const selectedImage = generatedImages.find(img => img.index === selectedImageIndex);
    if (!selectedImage) return;

    try {
      const img = await loadImageFromDataUrl(selectedImage.dataUrl);
      onImageGenerated(img);
      onClose();
      
      setPrompt('');
      setGeneratedImages([]);
      setSelectedImageIndex(null);
    } catch (err) {
      setError('Не удалось применить изображение');
    }
  }, [selectedImageIndex, generatedImages, onImageGenerated, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && isKeyValid) {
      e.preventDefault();
      handleGenerate();
    }
  }, [handleGenerate, isKeyValid]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
        style={{ animation: 'slideUp 0.3s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white">
              <SparklesIcon />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">AI Генератор</h2>
              <p className="text-xs text-gray-500">Gemini Image Generation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* API Key Setup */}
          {!isKeyValid && (
            <ApiKeySetup
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              onValidate={handleValidateKey}
              isValidating={isValidating}
              isValid={isKeyValid}
            />
          )}

          {isKeyValid && (
            <>
              {/* Prompt input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Описание изображения
                </label>
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Опишите изображение, которое хотите создать..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
                  rows={3}
                />
              </div>

              {/* Style selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Стиль</label>
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_PRESETS.map((style) => (
                    <StyleButton
                      key={style.id}
                      style={style}
                      isActive={selectedStyle === style.id}
                      onClick={setSelectedStyle}
                    />
                  ))}
                </div>
              </div>

              {/* Settings row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Соотношение сторон</label>
                  <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Количество</label>
                  <CountSelector value={imageCount} onChange={setImageCount} />
                </div>
              </div>

              {/* Image Grid */}
              {(generatedImages.length > 0 || isGenerating) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isGenerating ? 'Генерация...' : 'Выберите изображение'}
                  </label>
                  <ImageGrid
                    images={generatedImages}
                    selectedIndex={selectedImageIndex}
                    onSelect={setSelectedImageIndex}
                    isLoading={isGenerating}
                    count={imageCount}
                  />
                </div>
              )}
            </>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {isKeyValid && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || isGenerating}
              className="flex-1 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Генерация...
                </>
              ) : (
                <>
                  <SparklesIcon />
                  Создать
                </>
              )}
            </button>
            
            {generatedImages.length > 0 && selectedImageIndex !== null && (
              <button
                onClick={handleApply}
                className="px-6 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-all shadow-lg shadow-green-500/30"
              >
                Применить
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

export default memo(AIGenerationModal);