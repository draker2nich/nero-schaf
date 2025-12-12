import React, { useState, useCallback, useRef, useEffect, memo } from 'react';
import { 
  generateImages, 
  loadImageFromDataUrl, 
  fileToBase64,
  imageToBase64,
  STYLE_PRESETS, 
  ASPECT_RATIOS,
  applyStyleToPrompt,
  checkApiAvailability 
} from '../services/aiImageService';

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

const ImageIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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

// Компонент выбора количества (2-4)
const CountSelector = memo(({ value, onChange }) => (
  <div className="flex gap-1.5">
    {[2, 3, 4].map(n => (
      <button
        key={n}
        onClick={() => onChange(n)}
        className={`w-10 h-10 rounded-lg text-sm font-medium transition-all ${
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

// Компонент загрузки референса
const ReferenceUploader = memo(({ reference, onUpload, onRemove }) => {
  const inputRef = useRef(null);

  const handleChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const base64Data = await fileToBase64(file);
      const previewUrl = URL.createObjectURL(file);
      onUpload({ ...base64Data, previewUrl });
    } catch (err) {
      console.error('Failed to load reference:', err);
    }
    
    e.target.value = '';
  }, [onUpload]);

  if (reference) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border-2 border-violet-200">
        <img 
          src={reference.previewUrl} 
          alt="Референс" 
          className="w-16 h-16 object-cover rounded-lg ring-2 ring-violet-300"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-violet-700 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Референс активен
          </p>
          <p className="text-xs text-violet-600">AI создаст вариации на основе этого изображения</p>
        </div>
        <button
          onClick={onRemove}
          className="p-2 text-violet-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <TrashIcon />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
      >
        <ImageIcon />
        <span className="text-sm">Загрузить референс (опционально)</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
});

// Компонент сетки изображений
const ImageGrid = memo(({ images, selectedIndex, onSelect, isLoading, count }) => {
  const placeholders = Array.from({ length: count }, (_, i) => i);
  
  return (
    <div className="grid grid-cols-2 gap-3">
      {placeholders.map(i => {
        const image = images.find(img => img.index === i);
        const isSelected = selectedIndex === i;
        
        return (
          <div 
            key={i}
            onClick={() => image && onSelect(i)}
            className={`relative aspect-square rounded-xl overflow-hidden transition-all ${
              image 
                ? `cursor-pointer ${isSelected 
                    ? 'ring-3 ring-violet-500 ring-offset-2' 
                    : 'hover:ring-2 hover:ring-violet-300'}`
                : 'bg-gray-100'
            }`}
          >
            {image ? (
              <>
                <img src={image.dataUrl} alt={`Вариант ${i + 1}`} className="w-full h-full object-cover" />
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center text-white">
                    <CheckIcon />
                  </div>
                )}
              </>
            ) : isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-3 border-violet-200 border-t-violet-500 rounded-full animate-spin" />
                <span className="text-xs text-gray-400">Создание...</span>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                <span className="text-3xl font-light">{i + 1}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

// Компонент ошибки API
const ApiError = memo(({ error, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
      <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">Сервис недоступен</h3>
    <p className="text-sm text-gray-500 mb-4">{error}</p>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 transition-colors text-sm"
    >
      Попробовать снова
    </button>
  </div>
));

function AIGenerationModal({ isOpen, onClose, onImageGenerated }) {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('none');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageCount, setImageCount] = useState(4);
  const [referenceImage, setReferenceImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [error, setError] = useState(null);
  const [apiStatus, setApiStatus] = useState({ checked: false, available: true, error: null });
  const [hasGenerated, setHasGenerated] = useState(false);
  
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Проверка API при открытии
  useEffect(() => {
    if (isOpen && !apiStatus.checked) {
      checkApiAvailability().then(status => {
        setApiStatus({ checked: true, ...status });
      });
    }
  }, [isOpen, apiStatus.checked]);

  // Фокус на инпут при открытии
  useEffect(() => {
    if (isOpen && inputRef.current && apiStatus.available) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, apiStatus.available]);

  // Закрытие по Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && !isGenerating) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isGenerating, onClose]);

  // Очистка превью референса при закрытии
  useEffect(() => {
    if (!isOpen && referenceImage?.previewUrl) {
      URL.revokeObjectURL(referenceImage.previewUrl);
    }
  }, [isOpen, referenceImage]);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === modalRef.current && !isGenerating) onClose();
  }, [onClose, isGenerating]);

  const handleRetryApi = useCallback(() => {
    setApiStatus({ checked: false, available: true, error: null });
  }, []);

  const handleReferenceUpload = useCallback((data) => {
    setReferenceImage(data);
  }, []);

  const handleReferenceRemove = useCallback(() => {
    if (referenceImage?.previewUrl) {
      URL.revokeObjectURL(referenceImage.previewUrl);
    }
    setReferenceImage(null);
  }, [referenceImage]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);
    setSelectedImageIndex(null);
    setHasGenerated(false);

    try {
      const fullPrompt = applyStyleToPrompt(
        referenceImage 
          ? `Using the provided reference image as inspiration: ${prompt}`
          : prompt,
        selectedStyle
      );
      
      const result = await generateImages(fullPrompt, {
        count: imageCount,
        aspectRatio,
        referenceImage: referenceImage ? { data: referenceImage.data, mimeType: referenceImage.mimeType } : null
      });
      
      setGeneratedImages(result.images);
      if (result.images.length > 0) {
        setSelectedImageIndex(0);
      }
      setHasGenerated(true);
    } catch (err) {
      setError(err.message || 'Ошибка генерации');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, selectedStyle, aspectRatio, imageCount, referenceImage, isGenerating]);

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
      setHasGenerated(false);
      handleReferenceRemove();
    } catch (err) {
      setError('Не удалось применить изображение');
    }
  }, [selectedImageIndex, generatedImages, onImageGenerated, onClose, handleReferenceRemove]);

  const handleUseAsReference = useCallback(async () => {
    if (selectedImageIndex === null) return;
    
    const selectedImage = generatedImages.find(img => img.index === selectedImageIndex);
    if (!selectedImage) return;

    try {
      // Загружаем изображение
      const img = await loadImageFromDataUrl(selectedImage.dataUrl);
      
      // Конвертируем в base64
      const base64Data = await imageToBase64(img);
      
      // Устанавливаем как референс
      setReferenceImage({
        ...base64Data,
        previewUrl: selectedImage.dataUrl
      });
      
      // Очищаем сгенерированные изображения
      setGeneratedImages([]);
      setSelectedImageIndex(null);
      setHasGenerated(false);
      
      // Фокусируем на инпуте для нового промпта
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err) {
      setError('Не удалось использовать изображение как референс');
    }
  }, [selectedImageIndex, generatedImages]);

  const handleRegenerate = useCallback(() => {
    handleGenerate();
  }, [handleGenerate]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  }, [handleGenerate]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden"
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
              <p className="text-xs text-gray-500">Создание дизайна с помощью ИИ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-180px)]">
          {!apiStatus.available ? (
            <ApiError error={apiStatus.error} onRetry={handleRetryApi} />
          ) : (
            <>
              {/* Reference Image Upload */}
              <ReferenceUploader
                reference={referenceImage}
                onUpload={handleReferenceUpload}
                onRemove={handleReferenceRemove}
              />

              {/* Prompt input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {referenceImage ? 'Опишите изменения' : 'Описание изображения'}
                </label>
                <textarea
                  ref={inputRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={referenceImage 
                    ? "Например: Сделай в стиле акварели, добавь цветочный узор..."
                    : "Опишите изображение для дизайна одежды..."
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
                  rows={3}
                  disabled={isGenerating}
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
              <div className="flex gap-6">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Пропорции</label>
                  <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Кол-во</label>
                  <CountSelector value={imageCount} onChange={setImageCount} />
                </div>
              </div>

              {/* Image Grid */}
              {(generatedImages.length > 0 || isGenerating) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isGenerating ? 'Генерация вариантов...' : 'Выберите вариант'}
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

              {/* Error */}
              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {apiStatus.available && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            {hasGenerated && generatedImages.length > 0 && selectedImageIndex !== null ? (
              // Показываем три кнопки после генерации
              <div className="flex gap-2">
                <button
                  onClick={handleRegenerate}
                  disabled={isGenerating || !prompt.trim()}
                  className="flex-1 py-3 bg-white border-2 border-violet-500 text-violet-600 rounded-xl font-medium hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  <RefreshIcon />
                  <span className="text-sm">Пересоздать</span>
                </button>
                
                <button
                  onClick={handleUseAsReference}
                  disabled={isGenerating}
                  className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                >
                  <ImageIcon />
                  <span className="text-sm">Как референс</span>
                </button>
                
                <button
                  onClick={handleApply}
                  disabled={isGenerating}
                  className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 disabled:opacity-50 transition-all shadow-lg shadow-green-500/30 flex items-center justify-center gap-2"
                >
                  <CheckIcon />
                  <span className="text-sm">Применить</span>
                </button>
              </div>
            ) : (
              // Показываем кнопку "Создать" до генерации
              <button
                onClick={handleGenerate}
                disabled={!prompt.trim() || isGenerating}
                className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Создание...
                  </>
                ) : (
                  <>
                    <SparklesIcon />
                    Создать
                  </>
                )}
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
        .ring-3 {
          --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);
          --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(3px + var(--tw-ring-offset-width)) var(--tw-ring-color);
          box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);
        }
        .border-3 { border-width: 3px; }
      `}</style>
    </div>
  );
}

export default memo(AIGenerationModal);