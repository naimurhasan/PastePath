import { useState, useEffect, useCallback } from 'react';
import { Plus, Share2, LayoutList, Columns, Star } from 'lucide-react';
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
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);

  const addImage = useCallback((src: string) => {
    const newImage: AnnotatedImage = {
      id: crypto.randomUUID(),
      originalSrc: src,
      annotations: [],
      caption: '',
    };
    setImages(prev => {
      if (insertAfterIndex !== null) {
        const copy = [...prev];
        copy.splice(insertAfterIndex + 1, 0, newImage);
        return copy;
      }
      return [...prev, newImage];
    });
    setShowUploader(false);
    setInsertAfterIndex(null);
  }, [insertAfterIndex]);

  // Load cloned images from sessionStorage
  useEffect(() => {
    const cloned = sessionStorage.getItem('clone_images');
    if (cloned) {
      try {
        const parsed = JSON.parse(cloned) as AnnotatedImage[];
        // Give new IDs so they're independent
        const newImages = parsed.map(img => ({ ...img, id: crypto.randomUUID() }));
        setImages(newImages);
        setShowUploader(false);
      } catch { /* ignore */ }
      sessionStorage.removeItem('clone_images');
    }
  }, []);

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
  }, [addImage]);

  const updateImage = (updated: AnnotatedImage) => {
    setImages(prev => prev.map(img => img.id === updated.id ? updated : img));
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const updated = prev.filter(img => img.id !== id);
      // Show full placeholder if removing last image
      if (updated.length === 0) {
        setShowUploader(true);
      }
      return updated;
    });
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    setImages(prev => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
      return copy;
    });
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
        <div className="max-w-7xl mx-auto flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-bold text-foreground font-mono tracking-tight flex items-center gap-2 whitespace-nowrap">
              <img src="/logo.svg" alt="PastePath" className="h-6 w-6" /> PastePath
            </h1>
            <span className="text-xs text-muted-foreground hidden sm:inline">Screenshot Annotation Tool</span>
          </div>

          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
            <a
              href="https://github.com/naimurhasan/PastePath"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Star size={14} className="text-yellow-500 fill-yellow-500" />
              Star on GitHub
            </a>
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

        {/* Show uploader above images when there are images and showUploader is true */}
        {images.length > 0 && showUploader && (
          <div className="mb-6">
            <ImageUploader onImageAdd={addImage} />
          </div>
        )}

        {/* Show placeholder if no images and uploader is closed */}
        {images.length === 0 && !showUploader && (
          <div className="max-w-xl mx-auto mt-16 text-center">
            <p className="text-muted-foreground mb-4">No images yet</p>
            <Button onClick={() => setShowUploader(true)}>
              <Plus size={16} /> Add Image
            </Button>
          </div>
        )}

        {/* Image panels */}
        {images.length > 0 && (
          <div className={
            layout === 'horizontal'
              ? 'flex flex-col gap-6 sm:flex-row sm:overflow-x-auto sm:pb-4'
              : 'flex flex-col gap-6'
          }>
            {images.map((image, index) => (
              <div
                key={image.id}
                className={layout === 'horizontal' ? 'sm:min-w-[600px] sm:flex-shrink-0' : ''}
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
                  onMoveUp={index > 0 ? () => moveImage(index, 'up') : undefined}
                  onMoveDown={index < images.length - 1 ? () => moveImage(index, 'down') : undefined}
                />
                {/* Add image below button */}
                <div className="mt-3 flex flex-col items-center gap-3">
                  {insertAfterIndex === index ? (
                    <ImageUploader onImageAdd={addImage} />
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setInsertAfterIndex(index)}
                    >
                      <Plus size={14} /> Add image below
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Share dialog */}
      <ShareDialog images={images} open={shareOpen} onClose={() => setShareOpen(false)} />
    </div>
  );
}
