import type { Annotation } from '@/types/annotation';

export function drawAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation) {
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

  if (ann.tool === 'text' && ann.text && ann.startPoint) {
    const fontSize = ann.fontSize || 24;
    ctx.font = `${fontSize}px "Inter", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillStyle = ann.color;
    ctx.textBaseline = 'top';
    ann.text.split('\n').forEach((line, i) => {
      ctx.fillText(line, ann.startPoint!.x, ann.startPoint!.y + i * fontSize * 1.2);
    });
  }

  ctx.restore();
}
