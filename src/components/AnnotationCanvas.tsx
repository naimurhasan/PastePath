import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Annotation, DrawingPoint, ToolType } from '@/types/annotation';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

export interface AnnotationCanvasHandle {
  toBlob: () => Promise<Blob | null>;
  toDataURL: () => string;
}

interface Props {
  imageSrc: string;
  annotations: Annotation[];
  activeTool: ToolType;
  activeColor: string;
  activeSize: number;
  onAnnotationAdd: (annotation: Annotation) => void;
}

function drawAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation) {
  ctx.save();
  
  if (ann.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = ann.size * 4;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = ann.color;
    ctx.lineWidth = ann.size;
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if ((ann.tool === 'pencil' || ann.tool === 'eraser') && ann.points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(ann.points[0].x, ann.points[0].y);
    for (let i = 1; i < ann.points.length; i++) {
      ctx.lineTo(ann.points[i].x, ann.points[i].y);
    }
    ctx.stroke();
  }

  if (ann.tool === 'circle' && ann.startPoint && ann.endPoint) {
    const cx = (ann.startPoint.x + ann.endPoint.x) / 2;
    const cy = (ann.startPoint.y + ann.endPoint.y) / 2;
    const rx = Math.abs(ann.endPoint.x - ann.startPoint.x) / 2;
    const ry = Math.abs(ann.endPoint.y - ann.startPoint.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (ann.tool === 'square' && ann.startPoint && ann.endPoint) {
    const x = Math.min(ann.startPoint.x, ann.endPoint.x);
    const y = Math.min(ann.startPoint.y, ann.endPoint.y);
    const w = Math.abs(ann.endPoint.x - ann.startPoint.x);
    const h = Math.abs(ann.endPoint.y - ann.startPoint.y);
    ctx.strokeRect(x, y, w, h);
  }

  if (ann.tool === 'arrow' && ann.startPoint && ann.endPoint) {
    const { startPoint: s, endPoint: e } = ann;
    const angle = Math.atan2(e.y - s.y, e.x - s.x);
    const headLen = 15 + ann.size * 2;

    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(e.x, e.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x - headLen * Math.cos(angle - Math.PI / 6), e.y - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(e.x, e.y);
    ctx.lineTo(e.x - headLen * Math.cos(angle + Math.PI / 6), e.y - headLen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }

  ctx.restore();
}

const AnnotationCanvas = forwardRef<AnnotationCanvasHandle, Props>(function AnnotationCanvas({
  imageSrc, annotations, activeTool, activeColor, activeSize, onAnnotationAdd,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<DrawingPoint[]>([]);
  const [startPoint, setStartPoint] = useState<DrawingPoint | null>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 800, height: 600 });
  const [displaySize, setDisplaySize] = useState({ width: 800, height: 600 });
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Load image — fit within container
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const container = containerRef.current;
      if (container) {
        const maxW = container.clientWidth;
        const maxH = Math.min(window.innerHeight * 0.6, 600);
        const scaleW = maxW / img.width;
        const scaleH = maxH / img.height;
        const scale = Math.min(1, scaleW, scaleH);
        setNaturalSize({ width: img.width, height: img.height });
        setDisplaySize({ width: img.width * scale, height: img.height * scale });
      } else {
        const maxH = Math.min(window.innerHeight * 0.6, 600);
        const scale = Math.min(1, maxH / img.height);
        setNaturalSize({ width: img.width, height: img.height });
        setDisplaySize({ width: img.width * scale, height: img.height * scale });
      }
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Redraw
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d')!;
    annotations.forEach(ann => drawAnnotation(offCtx, ann));
    ctx.drawImage(offscreen, 0, 0);
  }, [annotations, naturalSize]);

  useEffect(() => {
    if (imageLoaded) redraw();
  }, [imageLoaded, redraw]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): DrawingPoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Middle mouse button OR hand tool for panning
    const isMiddleButton = 'button' in e && e.button === 1;
    if (isMiddleButton || activeTool === 'hand') {
      e.preventDefault();
      setIsPanning(true);
      const clientX = 'clientX' in e ? e.clientX : 0;
      const clientY = 'clientY' in e ? e.clientY : 0;
      setPanStart({ x: clientX - pan.x, y: clientY - pan.y });
      return;
    }
    
    e.preventDefault();
    const pos = getPos(e);
    setDrawing(true);
    setStartPoint(pos);
    setCurrentPoints([pos]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPanning) {
      const clientX = 'clientX' in e ? e.clientX : 0;
      const clientY = 'clientY' in e ? e.clientY : 0;
      setPan({ x: clientX - panStart.x, y: clientY - panStart.y });
      return;
    }
    
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    const sizeScale = naturalSize.width / displaySize.width;
    const scaledSize = activeSize * sizeScale;

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      setCurrentPoints(prev => [...prev, pos]);
      redraw();
      const pts = [...currentPoints, pos];
      const preview: Annotation = {
        id: 'preview',
        tool: activeTool,
        color: activeColor,
        size: scaledSize,
        points: pts,
      };
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const offCtx = offscreen.getContext('2d')!;
      drawAnnotation(offCtx, preview);
      ctx.drawImage(offscreen, 0, 0);
    } else {
      redraw();
      const preview: Annotation = {
        id: 'preview',
        tool: activeTool,
        color: activeColor,
        size: scaledSize,
        points: [],
        startPoint: startPoint!,
        endPoint: pos,
      };
      drawAnnotation(ctx, preview);
    }
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }
    
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const sizeScale = naturalSize.width / displaySize.width;
    const scaledSize = activeSize * sizeScale;
    const finalPoints = (activeTool === 'pencil' || activeTool === 'eraser') ? [...currentPoints, pos] : [];

    const annotation: Annotation = {
      id: crypto.randomUUID(),
      tool: activeTool,
      color: activeColor,
      size: scaledSize,
      points: finalPoints,
      startPoint: startPoint!,
      endPoint: pos,
    };

    onAnnotationAdd(annotation);
    setDrawing(false);
    setCurrentPoints([]);
    setStartPoint(null);
  };

  // Wheel zoom only when hand tool active
  const handleWheel = (e: React.WheelEvent) => {
    if (activeTool !== 'hand') return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.25, Math.min(4, prev + delta)));
  };

  const handleZoomIn = () => setZoom(prev => Math.min(4, prev + 0.25));
  const handleZoomOut = () => setZoom(prev => Math.max(0.25, prev - 0.25));
  const handleResetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  useImperativeHandle(ref, () => ({
    toBlob: () => new Promise((resolve) => {
      canvasRef.current?.toBlob(resolve, 'image/png');
    }),
    toDataURL: () => canvasRef.current?.toDataURL('image/png') || '',
  }), []);

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-1">
      {/* Zoom controls */}
      <div className="flex items-center justify-end gap-1 px-1">
        <button onClick={handleZoomOut} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-secondary" title="Zoom out">
          <ZoomOut size={14} />
        </button>
        <span className="text-xs font-mono text-muted-foreground min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button onClick={handleZoomIn} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-secondary" title="Zoom in">
          <ZoomIn size={14} />
        </button>
        <button onClick={handleResetView} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-secondary" title="Reset view">
          <RotateCcw size={14} />
        </button>
      </div>
      
      {/* Canvas viewport */}
      <div 
        className="overflow-hidden rounded-lg"
        style={{ 
          background: 'hsl(var(--canvas-bg))',
          maxHeight: Math.min(window.innerHeight * 0.6, 600),
          cursor: activeTool === 'hand' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair',
        }}
        onWheel={handleWheel}
      >
        <div
          className="flex justify-center"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center center',
            transition: isPanning || drawing ? 'none' : 'transform 0.15s ease',
          }}
        >
          <canvas
            ref={canvasRef}
            width={naturalSize.width}
            height={naturalSize.height}
            style={{ 
              width: displaySize.width, 
              height: displaySize.height,
              cursor: activeTool === 'hand' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair' 
            }}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>
      </div>
    </div>
  );
});

export default AnnotationCanvas;
