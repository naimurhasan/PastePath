import { Pencil, Circle, Square, ArrowUp, Eraser, Hand, Undo2, Redo2, Trash2 } from 'lucide-react';
import { ToolType } from '@/types/annotation';

const COLORS = ['#22d3ee', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ffffff', '#000000'];
const SIZES = [2, 4, 6, 10];

interface Props {
  activeTool: ToolType;
  onToolChange: (tool: ToolType) => void;
  activeColor: string;
  onColorChange: (color: string) => void;
  activeSize: number;
  onSizeChange: (size: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const tools: { type: ToolType; icon: React.ElementType; label: string; shortcut: string }[] = [
  { type: 'square', icon: Square, label: 'Rectangle', shortcut: '1' },
  { type: 'circle', icon: Circle, label: 'Circle', shortcut: '2' },
  { type: 'arrow', icon: ArrowUp, label: 'Arrow', shortcut: '3' },
  { type: 'pencil', icon: Pencil, label: 'Pencil', shortcut: '4' },
  { type: 'eraser', icon: Eraser, label: 'Eraser', shortcut: '5' },
  { type: 'hand', icon: Hand, label: 'Hand (Pan & Zoom)', shortcut: '6' },
];

export default function AnnotationToolbar({
  activeTool, onToolChange, activeColor, onColorChange,
  activeSize, onSizeChange, onUndo, onRedo, onClear, canUndo, canRedo,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-toolbar border border-border">
      {/* Tools */}
      <div className="flex items-center gap-1">
        {tools.map(({ type, icon: Icon, label, shortcut }) => (
          <button
            key={type}
            className={`tool-button ${activeTool === type ? 'active' : ''}`}
            onClick={() => onToolChange(type)}
            title={`${label} (${shortcut})`}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-border mx-1" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {COLORS.map((color) => (
          <button
            key={color}
            className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
            style={{
              backgroundColor: color,
              borderColor: activeColor === color ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              transform: activeColor === color ? 'scale(1.15)' : undefined,
            }}
            onClick={() => onColorChange(color)}
          />
        ))}
      </div>

      <div className="w-px h-8 bg-border mx-1" />

      {/* Sizes */}
      <div className="flex items-center gap-1">
        {SIZES.map((size) => (
          <button
            key={size}
            className={`tool-button ${activeSize === size ? 'active' : ''}`}
            onClick={() => onSizeChange(size)}
            title={`${size}px`}
          >
            <div className="rounded-full bg-current" style={{ width: size + 4, height: size + 4 }} />
          </button>
        ))}
      </div>

      <div className="w-px h-8 bg-border mx-1" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button className="tool-button" onClick={onUndo} disabled={!canUndo} title="Undo">
          <Undo2 size={18} />
        </button>
        <button className="tool-button" onClick={onRedo} disabled={!canRedo} title="Redo">
          <Redo2 size={18} />
        </button>
        <button className="tool-button" onClick={onClear} title="Clear all">
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}
