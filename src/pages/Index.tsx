import { useState, useEffect, useCallback } from 'react';
import { Plus, Share2, LayoutList, Columns } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ImageUploader from '@/components/ImageUploader';
import ImagePanel from '@/components/ImagePanel';
import ShareDialog from '@/components/ShareDialog';
import { AnnotatedImage, LayoutDirection } from '@/types/annotation';

export default function Index() {
  const [images, setImages] = useState<AnnotatedImage[]>([]);
  const [layout, setLayout] = useState<LayoutDirection>('vertical');
  const [showUploader, setShowUploader] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  // Global paste handler
  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result) addImage(ev.target.result as string);
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, []);

  const addImage = useCallback((src: string) => {
    const newImage: AnnotatedImage = {
      id: crypto.randomUUID(),
      originalSrc: src,
      annotations: [],
      caption: '',
    };
    setImages(prev => [...prev, newImage]);
    setShowUploader(false);
  }, []);

  const updateImage = (updated: AnnotatedImage) => {
    setImages(prev => prev.map(img => img.id === updated.id ? updated : img));
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  // Drop handler
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    Array.from(e.dataTransfer.files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) addImage(ev.target.result as string);
        };
        reader.readAsDataURL(file);
      }
    });
  }, [addImage]);

  return (
    <div
      className="min-h-screen bg-background"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground font-mono tracking-tight">
              <span className="text-primary">⬡</span> SnapNote
            </h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">Screenshot Annotation Tool</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Layout toggle */}
            <div className="flex items-center border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setLayout('vertical')}
                className={`p-2 transition-colors ${layout === 'vertical' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                title="Vertical layout"
              >
                <LayoutList size={16} />
              </button>
              <button
                onClick={() => setLayout('horizontal')}
                className={`p-2 transition-colors ${layout === 'horizontal' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                title="Horizontal layout"
              >
                <Columns size={16} />
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowUploader(true)}
            >
              <Plus size={16} /> Add Image
            </Button>

            {images.length > 0 && (
              <Button size="sm" onClick={() => setShareOpen(true)}>
                <Share2 size={16} /> Share
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {images.length === 0 && showUploader && (
          <div className="max-w-xl mx-auto mt-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Annotate & Share</h2>
              <p className="text-muted-foreground">
                Add screenshots, annotate them, write step-by-step instructions, and share with a link.
              </p>
            </div>
            <ImageUploader onImageAdd={addImage} />
          </div>
        )}

        {images.length > 0 && showUploader && (
          <div className="mb-6">
            <ImageUploader onImageAdd={addImage} />
          </div>
        )}

        {/* Image panels */}
        <div className={
          layout === 'horizontal'
            ? 'flex gap-6 overflow-x-auto pb-4'
            : 'flex flex-col gap-6'
        }>
          {images.map((image, index) => (
            <div
              key={image.id}
              className={layout === 'horizontal' ? 'min-w-[600px] flex-shrink-0' : ''}
            >
              <div className="mb-2">
                <span className="text-xs font-mono text-primary font-semibold">
                  Step {index + 1}
                </span>
              </div>
              <ImagePanel
                image={image}
                onUpdate={updateImage}
                onRemove={() => removeImage(image.id)}
              />
            </div>
          ))}
        </div>
      </main>

      {/* Share dialog */}
      <ShareDialog images={images} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
