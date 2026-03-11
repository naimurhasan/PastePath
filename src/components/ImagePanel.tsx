import { useState, useRef, useEffect } from 'react';
import { X, GripVertical, Download, ClipboardCopy, ChevronUp, ChevronDown } from 'lucide-react';
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
  const [activeTool, setActiveTool] = useState<ToolType>('square');
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Ctrl+Z / Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      // Tool shortcuts 1-6
      const toolMap: Record<string, ToolType> = {
        '1': 'square',
        '2': 'circle',
        '3': 'arrow',
        '4': 'pencil',
        '5': 'eraser',
        '6': 'text',
        '7': 'hand',
      };
      if (toolMap[e.key]) {
        setActiveTool(toolMap[e.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStack, redoStack, image.annotations]);

  const handleClear = () => {
    setUndoStack(prev => [...prev, image.annotations]);
    setRedoStack([]);
    onUpdate({ ...image, annotations: [] });
  };

  const handleCopyToClipboard = async () => {
    const blob = await canvasRef.current?.toBlob();
    if (blob) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast.success('Copied to clipboard');
    }
  };

  const handleDownload = () => {
    const url = canvasRef.current?.toDataURL();
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = `annotated-${image.id.slice(0, 8)}.png`;
      a.click();
    }
  };

  return (
    <div className="image-card flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border">
        <div className="flex items-center gap-2 text-muted-foreground">
          <GripVertical size={14} />
          <span className="text-xs font-mono">Step {image.id.slice(0, 4)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCopyToClipboard} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary" title="Copy to clipboard">
            <ClipboardCopy size={14} />
            <span>Copy</span>
          </button>
          <button onClick={handleDownload} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-secondary" title="Download">
            <Download size={14} />
            <span>Download</span>
          </button>
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors p-1">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-border overflow-x-auto">
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
      <div className="p-2">
        <AnnotationCanvas
          ref={canvasRef}
          imageSrc={image.originalSrc}
          annotations={image.annotations}
          activeTool={activeTool}
          activeColor={activeColor}
          activeSize={activeSize}
          onAnnotationAdd={handleAnnotationAdd}
        />
      </div>

      {/* Caption */}
      <div className="px-3 pb-3">
        <CaptionInput
          value={image.caption}
          onChange={(caption) => onUpdate({ ...image, caption })}
          placeholder="Write instructions for this step..."
        />
      </div>
    </div>
  );
}
