"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";

interface StreamingAudioPlayerProps {
  audioChunks: string[]; // Base64 MP3 chunks
  autoPlay?: boolean;
}

export function StreamingAudioPlayer({ audioChunks, autoPlay = true }: StreamingAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentIndexRef = useRef(0);
  const chunksRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const currentUrlRef = useRef<string | null>(null);

  useEffect(() => {
    chunksRef.current = audioChunks;
    
    // Auto-play if we have new chunks and were waiting or just started
    if (autoPlay && !isPlayingRef.current && chunksRef.current.length > currentIndexRef.current) {
      void playNextChunk({ userGesture: false });
    }
  }, [audioChunks, autoPlay]);

  useEffect(() => {
    // Cleanup
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
    };
  }, []);

  const playNextChunk = async ({ userGesture }: { userGesture: boolean }) => {
    if (currentIndexRef.current >= chunksRef.current.length) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.muted = false;
      audioRef.current.volume = 1;
      audioRef.current.onended = () => {
        currentIndexRef.current++;
        setCurrentIndex(currentIndexRef.current);
        void playNextChunk({ userGesture: false });
      };
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error:", e);
        // Try skip on error
        currentIndexRef.current++;
        setCurrentIndex(currentIndexRef.current);
        void playNextChunk({ userGesture: false });
      };
    }

    const chunk = chunksRef.current[currentIndexRef.current];
    try {
      // Use the standard MP3 mime type. Some browsers are picky about `audio/mp3`.
      const response = await fetch(`data:audio/mpeg;base64,${chunk}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      if (currentUrlRef.current) URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = url;
      audioRef.current.src = url;
      try {
        await audioRef.current.play();
        setAutoplayBlocked(false);
      } catch (err: any) {
        // Autoplay policies often block async audio playback unless it's triggered by a user gesture.
        if (!userGesture && (err?.name === "NotAllowedError" || err?.name === "AbortError")) {
          setAutoplayBlocked(true);
        }
        throw err;
      }
      setIsPlaying(true);
      isPlayingRef.current = true;
    } catch (error) {
      console.error("Error playing chunk:", error);
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      // Resume or Restart
      if (currentIndexRef.current >= chunksRef.current.length) {
        // Restart
        currentIndexRef.current = 0;
        setCurrentIndex(0);
      }
      void playNextChunk({ userGesture: true });
    }
  };

  const reset = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    setIsPlaying(false);
    isPlayingRef.current = false;
  };

  return (
    <div className="flex items-center gap-3 p-2 bg-secondary/20 rounded-md w-full">
      <Button variant="ghost" size="icon" onClick={togglePlay} className="h-8 w-8 shrink-0">
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${(chunksRef.current.length > 0 ? (currentIndex / chunksRef.current.length) * 100 : 0)}%` }}
        />
      </div>
      
      <div className="text-xs text-muted-foreground shrink-0 min-w-[60px] text-right">
        {currentIndex} / {audioChunks.length}
      </div>

      <Button variant="ghost" size="icon" onClick={reset} className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground">
        <RotateCcw className="h-3 w-3" />
      </Button>

      {autoplayBlocked && !isPlaying && (
        <div className="hidden sm:block text-xs text-muted-foreground">
          Audio blocked by browser. Click play.
        </div>
      )}
    </div>
  );
}
