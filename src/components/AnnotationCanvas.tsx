import { useRef, useEffect, useState, useCallback } from 'react';
import { Annotation, DrawingPoint, ToolType } from '@/types/annotation';

interface Props {
  imageSrc: string;
  annotations: Annotation[];
  activeTool: ToolType;
  activeColor: string;
  activeSize: number;
  onAnnotationAdd: (annotation: Annotation) => void;
}

function drawAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation) {
  ctx.strokeStyle = ann.color;
  ctx.lineWidth = ann.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (ann.tool === 'pencil' && ann.points.length > 1) {
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
}

export default function AnnotationCanvas({
  imageSrc, annotations, activeTool, activeColor, activeSize, onAnnotationAdd,
}: Props) {
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
      // Fit to container width
      const container = containerRef.current;
      if (container) {
        const maxW = container.clientWidth;
        const scale = Math.min(1, maxW / img.width);
        setCanvasSize({ width: img.width * scale, height: img.height * scale });
      } else {
        setCanvasSize({ width: img.width, height: img.height });
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

    annotations.forEach(ann => drawAnnotation(ctx, ann));
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
    if (activeTool === 'select') return;
    e.preventDefault();
    const pos = getPos(e);
    setDrawing(true);
    setStartPoint(pos);
    setCurrentPoints([pos]);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing || activeTool === 'select') return;
    e.preventDefault();
    const pos = getPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    if (activeTool === 'pencil') {
      setCurrentPoints(prev => [...prev, pos]);
      // Live draw
      redraw();
      const pts = [...currentPoints, pos];
      ctx.strokeStyle = activeColor;
      ctx.lineWidth = activeSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      pts.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
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
    if (!drawing || activeTool === 'select') return;
    e.preventDefault();
    const pos = getPos(e);
    const finalPoints = activeTool === 'pencil' ? [...currentPoints, pos] : [];

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
}
