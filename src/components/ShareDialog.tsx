import { useState } from 'react';
import { Share2, Lock, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnnotatedImage } from '@/types/annotation';

interface Props {
  images: AnnotatedImage[];
  open: boolean;
  onClose: () => void;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function ShareDialog({ images, open, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setShareUrl('');
      setCopied(false);
      setGenerating(false);
    }
  }, [open]);

  if (!open) return null;

  const generateShareLink = async () => {
    setGenerating(true);

    // Encode data as base64 in URL (client-side only for now)
    const payload: any = { images };
    if (password) {
      payload.passwordHash = await hashPassword(password);
    }

    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    // For large payloads, use localStorage + ID
    const shareId = crypto.randomUUID().slice(0, 8);
    localStorage.setItem(`share_${shareId}`, encoded);

    const url = `${window.location.origin}/view/${shareId}`;
    setShareUrl(url);
    setGenerating(false);
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Share2 size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Share Annotations</h3>
            <p className="text-sm text-muted-foreground">{images.length} image{images.length > 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Password */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Lock size={14} />
            Password protection (optional)
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full px-4 py-2.5 pr-10 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {password && (
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
              <Lock size={10} /> Password will be encrypted with SHA-256
            </p>
          )}
        </div>

        {/* Generate */}
        {!shareUrl ? (
          <Button className="w-full" onClick={generateShareLink} disabled={generating}>
            {generating ? 'Generating...' : 'Generate Share Link'}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm font-mono truncate"
              />
              <Button size="icon" onClick={copyUrl}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {password ? '🔒 Password protected' : '🔓 No password'}
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
