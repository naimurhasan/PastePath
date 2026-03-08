import { useState, useRef } from 'react';
import { X, GripVertical, Download, ClipboardCopy } from 'lucide-react';
import AnnotationCanvas, { AnnotationCanvasHandle } from './AnnotationCanvas';
import AnnotationToolbar from './AnnotationToolbar';
import CaptionInput from './CaptionInput';
import { Annotation, AnnotatedImage, ToolType } from '@/types/annotation';
import { toast } from 'sonner';

interface Props {
  image: AnnotatedImage;
  onUpdate: (image: AnnotatedImage) => void;
  onRemove: () => void;
}

export default function ImagePanel({ image, onUpdate, onRemove }: Props) {
  const canvasRef = useRef<AnnotationCanvasHandle>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('pencil');
  const [activeColor, setActiveColor] = useState('#ef4444');
  const [activeSize, setActiveSize] = useState(4);
  const [undoStack, setUndoStack] = useState<Annotation[][]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[][]>([]);

  const handleAnnotationAdd = (annotation: Annotation) => {
    setUndoStack(prev => [...prev, image.annotations]);
    setRedoStack([]);
    onUpdate({ ...image, annotations: [...image.annotations, annotation] });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [...r, image.annotations]);
    setUndoStack(u => u.slice(0, -1));
    onUpdate({ ...image, annotations: prev });
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(u => [...u, image.annotations]);
    setRedoStack(r => r.slice(0, -1));
    onUpdate({ ...image, annotations: next });
  };

  const handleClear = () => {
    setUndoStack(prev => [...prev, image.annotations]);
    setRedoStack([]);
    onUpdate({ ...image, annotations: [] });
  };

  return (
    <div className="image-card flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <GripVertical size={16} />
          <span className="text-xs font-mono">Step {image.id.slice(0, 4)}</span>
        </div>
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-3 border-b border-border overflow-x-auto">
        <AnnotationToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          activeColor={activeColor}
          onColorChange={setActiveColor}
          activeSize={activeSize}
          onSizeChange={setActiveSize}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onClear={handleClear}
          canUndo={undoStack.length > 0}
          canRedo={redoStack.length > 0}
        />
      </div>

      {/* Canvas */}
      <div className="p-4">
        <AnnotationCanvas
          imageSrc={image.originalSrc}
          annotations={image.annotations}
          activeTool={activeTool}
          activeColor={activeColor}
          activeSize={activeSize}
          onAnnotationAdd={handleAnnotationAdd}
        />
      </div>

      {/* Caption */}
      <div className="px-4 pb-4">
        <CaptionInput
          value={image.caption}
          onChange={(caption) => onUpdate({ ...image, caption })}
          placeholder="Write instructions for this step..."
        />
      </div>
    </div>
  );
}
