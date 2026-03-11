export type ToolType = 'pencil' | 'circle' | 'square' | 'arrow' | 'eraser' | 'hand' | 'text';
export type LayoutDirection = 'horizontal' | 'vertical';

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  tool: ToolType;
  color: string;
  size: number;
  points: DrawingPoint[];
  startPoint?: DrawingPoint;
  endPoint?: DrawingPoint;
  text?: string;
  fontSize?: number;
}

export interface AnnotatedImage {
  id: string;
  originalSrc: string;
  annotations: Annotation[];
  caption: string;
}
