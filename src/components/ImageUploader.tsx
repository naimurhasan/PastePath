import { useState, useRef, useCallback } from 'react';
import { Upload, Link, ClipboardPaste, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  onImageAdd: (src: string) => void;
}

export default function ImageUploader({ onImageAdd }: Props) {
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) onImageAdd(e.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(t => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) onImageAdd(e.target.result as string);
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      // Try text as URL
      const text = await navigator.clipboard.readText();
      if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
        onImageAdd(text);
      }
    } catch {
      // Clipboard API not available
    }
  }, [onImageAdd]);

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onImageAdd(urlInput.trim());
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-8 rounded-xl border-2 border-dashed border-border bg-card/50 hover:border-primary/50 transition-colors">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          Array.from(e.target.files || []).forEach(handleFile);
          e.target.value = '';
        }}
      />

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          <Upload size={18} />
          Browse
        </Button>
        <Button variant="secondary" onClick={handlePaste}>
          <ClipboardPaste size={18} />
          Paste
        </Button>
        <Button variant="secondary" onClick={() => setShowUrlInput(!showUrlInput)}>
          <Link size={18} />
          URL
        </Button>
      </div>

      {showUrlInput && (
        <div className="flex gap-2 w-full max-w-md">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
            placeholder="https://example.com/image.png"
            className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button onClick={handleUrlSubmit} size="sm">
            <Plus size={16} />
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Drop, paste, browse, or enter URL to add images
      </p>
    </div>
  );
}
