import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function CaptionInput({ value, onChange, placeholder = 'Add a caption or instruction...' }: Props) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    // Use browser default language for recognition
    recognition.lang = navigator.language || 'en-US';

    let finalTranscript = value;

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      onChange(finalTranscript + interim);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  const hasSpeechAPI = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  return (
    <div className="relative">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        className="w-full px-4 py-3 pr-12 rounded-lg bg-secondary border border-border text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
      />
      {hasSpeechAPI && (
        <button
          onClick={toggleVoice}
          className={`absolute right-3 top-3 p-1.5 rounded-lg transition-colors ${
            isListening
              ? 'bg-destructive/20 text-destructive animate-pulse'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
          title={isListening ? 'Stop recording' : 'Voice input (auto-detect language)'}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
      )}
    </div>
  );
}
