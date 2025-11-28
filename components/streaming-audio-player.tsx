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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentIndexRef = useRef(0);
  const chunksRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    chunksRef.current = audioChunks;
    
    // Auto-play if we have new chunks and were waiting or just started
    if (autoPlay && !isPlayingRef.current && chunksRef.current.length > currentIndexRef.current) {
      playNextChunk();
    }
  }, [audioChunks, autoPlay]);

  useEffect(() => {
    // Cleanup
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playNextChunk = async () => {
    if (currentIndexRef.current >= chunksRef.current.length) {
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => {
        currentIndexRef.current++;
        setCurrentIndex(currentIndexRef.current);
        playNextChunk();
      };
      audioRef.current.onerror = (e) => {
        console.error("Audio playback error:", e);
        // Try skip on error
        currentIndexRef.current++;
        setCurrentIndex(currentIndexRef.current);
        playNextChunk();
      };
    }

    const chunk = chunksRef.current[currentIndexRef.current];
    try {
      const response = await fetch(`data:audio/mp3;base64,${chunk}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      audioRef.current.src = url;
      await audioRef.current.play();
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
      playNextChunk();
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
    </div>
  );
}
