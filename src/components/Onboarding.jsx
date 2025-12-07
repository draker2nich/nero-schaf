import React from 'react';

export default function Onboarding({ show, onClose }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Добро пожаловать в Дизайнер Одежды!</h2>
          <p className="text-gray-600">Создавайте уникальные дизайны на 3D моделях одежды</p>
        </div>
        
        <div className="space-y-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-lg">🎨</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Рисование и дизайн</h3>
              <p className="text-sm text-gray-600">Используйте кисти, текст и изображения для создания дизайна</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-lg">👁️</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">3D предпросмотр</h3>
              <p className="text-sm text-gray-600">Смотрите свой дизайн на 3D модели в реальном времени</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-lg">💾</span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Экспорт</h3>
              <p className="text-sm text-gray-600">Скачайте свой дизайн для печати или дальнейшего редактирования</p>
            </div>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          Начать работу!
        </button>
      </div>
    </div>
  );
}