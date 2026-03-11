import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnnotatedImage } from '@/types/annotation';
import AnnotationCanvas from '@/components/AnnotationCanvas';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  const [rawData, setRawData] = useState<any>(null);

  useEffect(() => {
    const fetchShare = async () => {
      const { data, error: fetchError } = await supabase
        .from('shares')
        .select('data, password_hash')
        .eq('id', id!)
        .single();

      if (fetchError || !data) {
        setError('Share link not found or expired');
        return;
      }

      setRawData(data.data);
      if (data.password_hash) {
        setPasswordHash(data.password_hash);
        setNeedsPassword(true);
      } else {
        setImages((data.data as any).images);
      }
    };

    if (id) fetchShare();
  }, [id]);

  const handleUnlock = async () => {
    const hash = await hashPassword(password);
    if (hash === passwordHash) {
      setImages(rawData.images);
      setNeedsPassword(false);
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
          <Button
            size="sm"
            onClick={() => {
              // Store images in sessionStorage and navigate to editor
              sessionStorage.setItem('clone_images', JSON.stringify(images));
              navigate('/');
              toast.success('Cloned to editor!');
            }}
          >
            <Copy size={16} /> Clone to Editor
          </Button>
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
                <p className="text-sm text-foreground bg-secondary rounded-lg px-4 py-3 whitespace-pre-wrap">{image.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
