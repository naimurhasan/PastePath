import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, ArrowLeft, Copy, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnnotatedImage } from '@/types/annotation';
import AnnotationCanvas from '@/components/AnnotationCanvas';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ShareData {
  id: string;
  title: string | null;
  data: any;
  view_count: number;
  status: string;
  requires_password: boolean;
  access_granted: boolean;
}

export default function ViewShare() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [images, setImages] = useState<AnnotatedImage[] | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [viewCount, setViewCount] = useState<number>(0);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchShare = async (pwd?: string) => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('view-share', {
        body: { id: id!, password: pwd || null },
      });

      if (fetchError || !data) {
        setError('Share link not found or expired');
        setLoading(false);
        return;
      }

      const shareData: ShareData = data;

      if (shareData.status === 'not_found' || shareData.status === 'deleted') {
        setError('Share link not found or has been deleted');
        setLoading(false);
        return;
      }

      if (shareData.status === 'expired') {
        setError('This share has expired');
        setLoading(false);
        return;
      }

      if (shareData.status === 'password_required') {
        setPasswordRequired(true);
        if (pwd) setError('Incorrect password');
        setLoading(false);
        return;
      }

      if (shareData.status === 'ok' && shareData.access_granted) {
        if (shareData.data?.images) {
          setImages(shareData.data.images);
          setTitle(shareData.title);
          setViewCount(shareData.view_count);
          setPasswordRequired(false);
          setError('');
        }
      }
      setLoading(false);
    } catch (err) {
      console.error('Fetch share error:', err);
      setError('Failed to load share');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchShare();
  }, [id]);

  const handleUnlock = async () => {
    const pwd = password;
    setPassword('');
    setError('');
    await fetchShare(pwd);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error && !passwordRequired) {
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

  if (passwordRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full mx-4">
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Lock size={24} className="text-primary" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-foreground text-center mb-2">Password Protected</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">Enter the password to view this share</p>
          {error && <p className="text-destructive text-sm text-center mb-3">{error}</p>}
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            placeholder="Enter password..."
            autoFocus
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
        <p className="text-muted-foreground">No content available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Button variant="secondary" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft size={16} /> Back
            </Button>
            <div className="flex-1">
              <h1 className="text-lg sm:text-xl font-semibold text-foreground truncate">{title || 'Shared Annotations'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground flex-shrink-0">
            <Eye size={16} />
            <span>{viewCount}</span>
          </div>
        </div>

        <Button
          onClick={() => {
            sessionStorage.setItem('clone_images', JSON.stringify(images));
            navigate('/');
            toast.success('Cloned to editor!');
          }}
          className="w-full sm:w-auto"
        >
          <Copy size={16} /> Clone to Editor
        </Button>

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
