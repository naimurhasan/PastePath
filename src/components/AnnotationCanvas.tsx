import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Annotation, DrawingPoint, ToolType } from '@/types/annotation';

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
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      const container = containerRef.current;
      if (container) {
        const maxW = container.clientWidth;
        const maxH = window.innerHeight * 0.75; // Keep within viewport
        const scaleW = maxW / img.width;
        const scaleH = maxH / img.height;
        const scale = Math.min(1, scaleW, scaleH);
        setCanvasSize({ width: img.width * scale, height: img.height * scale });
      } else {
        setCanvasSize({ width: img.width, height: img.height });
      }
      setImageLoaded(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Redraw — draw image on base, then annotations on a separate layer to support eraser
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;

    // Draw image
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw annotations on an offscreen canvas so eraser only erases annotations, not the image
    const offscreen = document.createElement('canvas');
    offscreen.width = canvas.width;
    offscreen.height = canvas.height;
    const offCtx = offscreen.getContext('2d')!;
    annotations.forEach(ann => drawAnnotation(offCtx, ann));
    ctx.drawImage(offscreen, 0, 0);
  }, [annotations, canvasSize]);

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
    e.preventDefault();
    const pos = getPos(e);
    setDrawing(true);
    setStartPoint(pos);
    setCurrentPoints([pos]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      setCurrentPoints(prev => [...prev, pos]);
      redraw();
      const pts = [...currentPoints, pos];
      const preview: Annotation = {
        id: 'preview',
        tool: activeTool,
        color: activeColor,
        size: activeSize,
        points: pts,
      };
      // Draw on offscreen for eraser support
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const offCtx = offscreen.getContext('2d')!;
      drawAnnotation(offCtx, preview);
      ctx.drawImage(offscreen, 0, 0);
    } else {
      // Shape preview
      redraw();
      const preview: Annotation = {
        id: 'preview',
        tool: activeTool,
        color: activeColor,
        size: activeSize,
        points: [],
        startPoint: startPoint!,
        endPoint: pos,
      };
      drawAnnotation(ctx, preview);
    }
  };

  const handleEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const finalPoints = (activeTool === 'pencil' || activeTool === 'eraser') ? [...currentPoints, pos] : [];

    const annotation: Annotation = {
      id: crypto.randomUUID(),
      tool: activeTool,
      color: activeColor,
      size: activeSize,
      points: finalPoints,
      startPoint: startPoint!,
      endPoint: pos,
    };

    onAnnotationAdd(annotation);
    setDrawing(false);
    setCurrentPoints([]);
    setStartPoint(null);
  };

  useImperativeHandle(ref, () => ({
    toBlob: () => new Promise((resolve) => {
      canvasRef.current?.toBlob(resolve, 'image/png');
    }),
    toDataURL: () => canvasRef.current?.toDataURL('image/png') || '',
  }), []);

  return (
    <div ref={containerRef} className="w-full flex justify-center">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="annotation-canvas rounded-lg max-w-full"
        style={{ background: 'hsl(var(--canvas-bg))' }}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
      />
    </div>
  );
});

export default AnnotationCanvas;
