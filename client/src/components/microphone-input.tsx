import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MicrophoneInputProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export function MicrophoneInput({ onTranscription, disabled = false, className = "" }: MicrophoneInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/wav' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        setMediaRecorder(null);
      };

      recorder.start();
      setIsRecording(true);
      setMediaRecorder(recorder);

      // Stop recording after 30 seconds max
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
          setIsRecording(false);
        }
      }, 30000);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording failed",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Transcription failed');
      }

      const data = await response.json();
      
      if (data.text) {
        onTranscription(data.text);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      toast({
        title: "Transcription failed",
        description: "Could not transcribe audio. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={isRecording ? "destructive" : "outline"}
      className={`w-8 h-8 rounded-full p-0 ${className}`}
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled}
    >
      {isRecording ? (
        <MicOff className="w-4 h-4" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </Button>
  );
}