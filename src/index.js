import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

// ВАЖНО: StrictMode вызывает двойную инициализацию компонентов в dev режиме,
// что ломает WebGL (создаётся 2 контекста, один сразу теряется).
// Для production это не проблема, но в dev режиме отключаем StrictMode.
const isDev = process.env.NODE_ENV === 'development';

root.render(
  isDev ? (
    <App />
  ) : (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
);