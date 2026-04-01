import { useState, useEffect } from 'react';
import { Share2, Lock, Copy, Check, Eye, EyeOff, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnnotatedImage } from '@/types/annotation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  images: AnnotatedImage[];
  open: boolean;
  onClose: () => void;
}

function compressImage(dataUrl: string, quality = 0.55): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

const RETENTION_OPTIONS = [
  { value: '1year', label: '1 Year', days: 365 },
  { value: 'never', label: 'Never', days: null },
  { value: '1month', label: '1 Month', days: 30 },
  { value: '1week', label: '1 Week', days: 7 },
  { value: '1day', label: '1 Day', days: 1 },
];

export default function ShareDialog({ images, open, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [retention, setRetention] = useState('1year');

  useEffect(() => {
    if (open) {
      setTitle('');
      setPassword('');
      setShowPassword(false);
      setShareUrl('');
      setCopied(false);
      setGenerating(false);
      setRetention('1year');
    }
  }, [open]);

  if (!open) return null;

  const generateShareLink = async () => {
    if (!title.trim()) {
      toast.error('Please enter a title for your share');
      return;
    }

    setGenerating(true);

    try {
      const compressedImages = await Promise.all(
        images.map(async (img) => ({
          ...img,
          originalSrc: await compressImage(img.originalSrc),
        }))
      );

      const selectedOption = RETENTION_OPTIONS.find((o) => o.value === retention);
      const autoDeleteAt = selectedOption?.days
        ? new Date(Date.now() + selectedOption.days * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Use edge function for server-side validation, ID generation, and bcrypt hashing
      const { data, error } = await supabase.functions.invoke('create-share', {
        body: {
          title: title.trim(),
          password: password || null,
          data: { images: compressedImages },
          auto_delete_at: autoDeleteAt,
        },
      });

      if (error || !data?.id) {
        console.error('Share creation error:', error);
        toast.error('Failed to create share link. Try fewer or smaller images.');
        setGenerating(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/og-metadata?id=${data.id}`;
      setShareUrl(url);
      toast.success(`Share will ${selectedOption?.days ? `auto-delete in ${selectedOption.label.toLowerCase()}` : `never auto-delete`}`);
    } catch (err) {
      console.error('Share generation failed:', err);
      toast.error('Failed to generate share link');
    }
    setGenerating(false);
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

        {/* Title */}
        <div className="mb-4">
          <label className="block text-sm text-muted-foreground mb-2 font-medium">
            Share Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Project Screenshot"
            className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Retention Selector */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2 font-medium">
            <Calendar size={14} />
            Auto-delete
          </label>
          <select
            value={retention}
            onChange={(e) => setRetention(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {RETENTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1.5">
            {RETENTION_OPTIONS.find((o) => o.value === retention)?.days
              ? `Share will be deleted after ${RETENTION_OPTIONS.find((o) => o.value === retention)?.label.toLowerCase()}`
              : 'Share will never be automatically deleted'}
          </p>
        </div>

        {/* Password */}
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground mb-2 font-medium">
            <Lock size={14} />
            Password protection (optional)
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for public share"
              className="w-full px-4 py-2.5 pr-10 rounded-lg bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Generate */}
        {!shareUrl ? (
          <Button className="w-full" onClick={generateShareLink} disabled={generating || !title.trim()}>
            {generating ? 'Creating...' : 'Create Share'}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm font-mono truncate"
              />
              <Button size="icon" onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {password ? '🔒 Password protected' : '🔓 No password'} • Shareable globally!
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
