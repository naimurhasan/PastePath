import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnnotatedImage } from '@/types/annotation';
import AnnotationCanvas from '@/components/AnnotationCanvas';

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function ViewShare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [images, setImages] = useState<AnnotatedImage[] | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [passwordHash, setPasswordHash] = useState('');

  useEffect(() => {
    const data = localStorage.getItem(`share_${id}`);
    if (!data) {
      setError('Share link not found or expired');
      return;
    }
    try {
      // Decode: base64 -> bytes -> UTF-8 string -> JSON
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const jsonStr = new TextDecoder().decode(bytes);
      const decoded = JSON.parse(jsonStr);
      if (decoded.passwordHash) {
        setPasswordHash(decoded.passwordHash);
        setNeedsPassword(true);
      } else {
        setImages(decoded.images);
      }
    } catch {
      setError('Invalid share data');
    }
  }, [id]);

  const handleUnlock = async () => {
    const hash = await hashPassword(password);
    if (hash === passwordHash) {
      const data = localStorage.getItem(`share_${id}`);
      if (data) {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const decoded = JSON.parse(new TextDecoder().decode(bytes));
        setImages(decoded.images);
        setNeedsPassword(false);
      }
    } else {
      setError('Incorrect password');
    }
  };

  if (error && !needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <p className="text-destructive text-lg">{error}</p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Back to editor
          </Button>
        </div>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full mx-4">
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock size={24} className="text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-foreground text-center mb-2">Password Protected</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">Enter the password to view these annotations</p>
          {error && <p className="text-destructive text-sm text-center mb-3">{error}</p>}
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            placeholder="Enter password..."
            className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button className="w-full" onClick={handleUnlock}>Unlock</Button>
        </div>
      </div>
    );
  }

  if (!images) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Back to editor
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Shared Annotations</h1>
        </div>
        {images.map((image, index) => (
          <div key={image.id} className="image-card">
            <div className="px-4 py-2 border-b border-border">
              <span className="text-xs font-mono text-muted-foreground">Step {index + 1}</span>
            </div>
            <div className="p-4">
              <AnnotationCanvas
                imageSrc={image.originalSrc}
                annotations={image.annotations}
                activeTool="pencil"
                activeColor="#000"
                activeSize={2}
                onAnnotationAdd={() => {}}
              />
            </div>
            {image.caption && (
              <div className="px-4 pb-4">
                <p className="text-sm text-foreground bg-secondary rounded-lg px-4 py-3">{image.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
