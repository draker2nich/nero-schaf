import { CANVAS_SIZE, TOOLS } from './constants';

export function isPixelInUVMask(uvLayoutImage, x, y) {
  if (!uvLayoutImage) return true;
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = 1;
  tempCanvas.height = 1;
  const tempCtx = tempCanvas.getContext('2d');
  
  tempCtx.drawImage(uvLayoutImage, x, y, 1, 1, 0, 0, 1, 1);
  const pixel = tempCtx.getImageData(0, 0, 1, 1).data;
  
  return pixel[3] > 0;
}

export function drawLine(x0, y0, x1, y1, tool, brushColor, brushSize, uvLayoutImage, drawingCtx) {
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = CANVAS_SIZE;
  tempCanvas.height = CANVAS_SIZE;
  const tempCtx = tempCanvas.getContext('2d');
  
  tempCtx.lineCap = 'round';
  tempCtx.lineJoin = 'round';
  
  if (tool === TOOLS.DRAW) {
    tempCtx.strokeStyle = brushColor;
    tempCtx.lineWidth = brushSize * 2;
    tempCtx.beginPath();
    tempCtx.moveTo(x0, y0);
    tempCtx.lineTo(x1, y1);
    tempCtx.stroke();
    
    if (uvLayoutImage) {
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(uvLayoutImage, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    
    drawingCtx.drawImage(tempCanvas, 0, 0);
    
  } else if (tool === TOOLS.ERASE) {
    tempCtx.strokeStyle = 'white';
    tempCtx.lineWidth = brushSize * 2;
    tempCtx.beginPath();
    tempCtx.moveTo(x0, y0);
    tempCtx.lineTo(x1, y1);
    tempCtx.stroke();
    
    drawingCtx.save();
    drawingCtx.globalCompositeOperation = 'destination-out';
    drawingCtx.drawImage(tempCanvas, 0, 0);
    drawingCtx.restore();
  }
}

export function getCanvasCoords(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * (CANVAS_SIZE / rect.width),
    y: (clientY - rect.top) * (CANVAS_SIZE / rect.height)
  };
}