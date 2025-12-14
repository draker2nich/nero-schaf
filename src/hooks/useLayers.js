import { useState, useCallback, useRef, useEffect } from 'react';
import { CANVAS_SIZE, MAX_HISTORY } from '../utils/constants';

export const LAYER_TYPES = {
  BASE: 'base',
  DRAWING: 'drawing',
  IMAGE: 'image'
};

function createLayer(type, name, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d', { 
    willReadFrequently: false,
    alpha: true 
  });
  
  if (type === LAYER_TYPES.BASE) {
    ctx.fillStyle = options.color || '#ffffff';
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }
  
  return {
    id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type, name, visible: true, canvas, ctx,
    locked: type === LAYER_TYPES.BASE,
    opacity: 1,
    ...options
  };
}

function serializeLayer(layer) {
  // Используем меньшее качество на мобильных для экономии памяти
  const quality = CANVAS_SIZE <= 512 ? 0.6 : 0.8;
  return {
    id: layer.id, type: layer.type, name: layer.name,
    visible: layer.visible, locked: layer.locked, opacity: layer.opacity,
    dataUrl: layer.canvas.toDataURL('image/png', quality)
  };
}

function deserializeLayer(serialized) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d', { 
      willReadFrequently: false,
      alpha: true 
    });
    const img = new Image();
    img.onload = () => { 
      ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE); 
      resolve({ ...serialized, canvas, ctx, dataUrl: undefined }); 
    };
    img.onerror = () => resolve({ ...serialized, canvas, ctx, dataUrl: undefined });
    img.src = serialized.dataUrl;
  });
}

export function useLayers(onCanvasUpdate) {
  const [layers, setLayers] = useState([]);
  const [activeLayerId, setActiveLayerId] = useState(null);
  const [layerCounter, setLayerCounter] = useState({ drawing: 0, image: 0 });
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isRestoringRef = useRef(false);
  const initializedRef = useRef(false);
  const layersRef = useRef(layers);
  const activeLayerIdRef = useRef(activeLayerId);
  const layerCounterRef = useRef(layerCounter);

  useEffect(() => { layersRef.current = layers; }, [layers]);
  useEffect(() => { activeLayerIdRef.current = activeLayerId; }, [activeLayerId]);
  useEffect(() => { layerCounterRef.current = layerCounter; }, [layerCounter]);

  const updateHistoryState = useCallback(() => {
    setHistoryState({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1
    });
  }, []);

  const saveToHistory = useCallback(async () => {
    if (isRestoringRef.current) return;
    
    const currentLayers = layersRef.current;
    
    if (!currentLayers || currentLayers.length === 0) {
      console.warn('saveToHistory: no layers to save');
      return;
    }
    
    const serializedLayers = await Promise.all(currentLayers.map(l => serializeLayer(l)));
    const snapshot = { 
      layers: serializedLayers, 
      activeLayerId: activeLayerIdRef.current, 
      layerCounter: { ...layerCounterRef.current } 
    };
    
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(snapshot);
    
    // Используем MAX_HISTORY из констант
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    } else {
      historyIndexRef.current = newHistory.length - 1;
    }
    
    historyRef.current = newHistory;
    updateHistoryState();
  }, [updateHistoryState]);

  const restoreFromHistory = useCallback(async (index) => {
    if (index < 0 || index >= historyRef.current.length || isRestoringRef.current) return;
    
    isRestoringRef.current = true;
    const snapshot = historyRef.current[index];
    const restoredLayers = await Promise.all(snapshot.layers.map(s => deserializeLayer(s)));
    
    layersRef.current = restoredLayers;
    activeLayerIdRef.current = snapshot.activeLayerId;
    layerCounterRef.current = snapshot.layerCounter;
    
    setLayers(restoredLayers);
    setActiveLayerId(snapshot.activeLayerId);
    setLayerCounter(snapshot.layerCounter);
    
    setTimeout(() => { 
      onCanvasUpdate?.(true); 
      isRestoringRef.current = false; 
    }, 0);
  }, [onCanvasUpdate]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    const baseLayer = createLayer(LAYER_TYPES.BASE, 'Фон', { color: '#ffffff' });
    
    layersRef.current = [baseLayer];
    activeLayerIdRef.current = baseLayer.id;
    
    setLayers([baseLayer]);
    setActiveLayerId(baseLayer.id);
    
    setTimeout(async () => {
      const serialized = serializeLayer(baseLayer);
      historyRef.current = [{ 
        layers: [serialized], 
        activeLayerId: baseLayer.id, 
        layerCounter: { drawing: 0, image: 0 } 
      }];
      historyIndexRef.current = 0;
      updateHistoryState();
    }, 0);
  }, [updateHistoryState]);

  const getActiveLayer = useCallback(() => {
    return layersRef.current.find(l => l.id === activeLayerIdRef.current);
  }, []);

  const addDrawingLayer = useCallback(() => {
    const n = layerCounterRef.current.drawing + 1;
    const layer = createLayer(LAYER_TYPES.DRAWING, `Рисунок ${n}`);
    
    const newLayers = [...layersRef.current, layer];
    layersRef.current = newLayers;
    activeLayerIdRef.current = layer.id;
    layerCounterRef.current = { ...layerCounterRef.current, drawing: n };
    
    setLayers(newLayers);
    setActiveLayerId(layer.id);
    setLayerCounter(prev => ({ ...prev, drawing: n }));
    
    return layer;
  }, []);

  const addImageLayer = useCallback((image, transform = null) => {
    const n = layerCounterRef.current.image + 1;
    const layer = createLayer(LAYER_TYPES.IMAGE, `Изображение ${n}`, { 
      sourceImage: image, 
      transform: transform || { x: 0, y: 0, scale: 1, rotation: 0 } 
    });
    
    const newLayers = [...layersRef.current, layer];
    layersRef.current = newLayers;
    activeLayerIdRef.current = layer.id;
    layerCounterRef.current = { ...layerCounterRef.current, image: n };
    
    setLayers(newLayers);
    setActiveLayerId(layer.id);
    setLayerCounter(prev => ({ ...prev, image: n }));
    
    return layer;
  }, []);

  const toggleLayerVisibility = useCallback((id) => {
    const newLayers = layersRef.current.map(l => 
      l.id === id ? { ...l, visible: !l.visible } : l
    );
    layersRef.current = newLayers;
    setLayers(newLayers);
    onCanvasUpdate?.(true);
  }, [onCanvasUpdate]);

  const moveLayerUp = useCallback((id) => {
    const i = layersRef.current.findIndex(l => l.id === id);
    if (i < 0 || i >= layersRef.current.length - 1) return;
    
    const arr = [...layersRef.current];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    
    layersRef.current = arr;
    setLayers(arr);
    onCanvasUpdate?.(true);
  }, [onCanvasUpdate]);

  const moveLayerDown = useCallback((id) => {
    const i = layersRef.current.findIndex(l => l.id === id);
    if (i <= 1) return;
    
    const arr = [...layersRef.current];
    [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
    
    layersRef.current = arr;
    setLayers(arr);
    onCanvasUpdate?.(true);
  }, [onCanvasUpdate]);

  const deleteLayer = useCallback((id) => {
    const layer = layersRef.current.find(l => l.id === id);
    if (!layer || layer.locked) return;
    
    const arr = layersRef.current.filter(l => l.id !== id);
    
    if (activeLayerIdRef.current === id && arr.length > 0) {
      activeLayerIdRef.current = arr[arr.length - 1].id;
      setActiveLayerId(arr[arr.length - 1].id);
    }
    
    layersRef.current = arr;
    setLayers(arr);
    
    setTimeout(() => { 
      saveToHistory(); 
      onCanvasUpdate?.(true); 
    }, 0);
  }, [saveToHistory, onCanvasUpdate]);

  const clearActiveLayer = useCallback(() => {
    const layer = getActiveLayer();
    if (!layer) return;
    
    layer.ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    if (layer.type === LAYER_TYPES.BASE) { 
      layer.ctx.fillStyle = '#ffffff'; 
      layer.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE); 
    }
    
    setLayers(prev => [...prev]);
    saveToHistory();
    onCanvasUpdate?.(true);
  }, [getActiveLayer, saveToHistory, onCanvasUpdate]);

  const clearAllLayers = useCallback(() => {
    const baseLayer = createLayer(LAYER_TYPES.BASE, 'Фон', { color: '#ffffff' });
    
    layersRef.current = [baseLayer];
    activeLayerIdRef.current = baseLayer.id;
    layerCounterRef.current = { drawing: 0, image: 0 };
    
    setLayers([baseLayer]);
    setActiveLayerId(baseLayer.id);
    setLayerCounter({ drawing: 0, image: 0 });
    
    setTimeout(() => { 
      saveToHistory(); 
      onCanvasUpdate?.(true); 
    }, 0);
  }, [saveToHistory, onCanvasUpdate]);

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0 || isRestoringRef.current) return;
    historyIndexRef.current--;
    updateHistoryState();
    restoreFromHistory(historyIndexRef.current);
  }, [restoreFromHistory, updateHistoryState]);

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1 || isRestoringRef.current) return;
    historyIndexRef.current++;
    updateHistoryState();
    restoreFromHistory(historyIndexRef.current);
  }, [restoreFromHistory, updateHistoryState]);

  return {
    layers, activeLayerId, setActiveLayerId, getActiveLayer,
    addDrawingLayer, addImageLayer, toggleLayerVisibility,
    moveLayerUp, moveLayerDown, deleteLayer,
    clearActiveLayer, clearAllLayers, saveToHistory,
    undo, redo, canUndo: historyState.canUndo, canRedo: historyState.canRedo
  };
}