import React, { useEffect, useRef, useState } from 'react';
import { VideoPlatform } from '../types';
import { PlayCircle, Tv, ExternalLink, Play, Pause, RotateCcw } from 'lucide-react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface VideoPlayerProps {
  platform: VideoPlatform;
  videoId: string; // YouTube ID or VK oid_id
  vkOid?: string;
  vkId?: string;
  vkHash?: string;
  isHost: boolean;
  onSyncAction: (action: 'play' | 'pause' | 'seek', time: number) => void;
  incomingSync: { action: 'play' | 'pause' | 'seek'; time: number; timestamp: number } | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  platform,
  videoId,
  vkOid,
  vkId,
  vkHash,
  isHost,
  onSyncAction,
  incomingSync,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const vkIframeRef = useRef<HTMLIFrameElement>(null);
  const isIncomingSyncRef = useRef<boolean>(false);
  const lastTimeRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);

  // 1. YouTube Player Initializer
  useEffect(() => {
    if (platform !== 'youtube') return;

    let destroyed = false;

    const initYT = () => {
      if (destroyed || !window.YT || !window.YT.Player) return;

      // Clear existing content
      const targetDiv = document.getElementById('yt-player-target');
      if (!targetDiv) return;

      try {
        if (ytPlayerRef.current) {
          try { ytPlayerRef.current.destroy(); } catch {}
          ytPlayerRef.current = null;
        }

        ytPlayerRef.current = new window.YT.Player('yt-player-target', {
          height: '100%',
          width: '100%',
          videoId: videoId || 'dQw4w9WgXcQ',
          playerVars: {
            autoplay: 0,
            playsinline: 1,
            rel: 0,
            controls: 1,
            disablekb: 0,
            fs: 1,
          },
          events: {
            onReady: () => {
              console.log('YouTube player ready');
            },
            onStateChange: (event: any) => {
              if (isIncomingSyncRef.current) return;
              const player = ytPlayerRef.current;
              if (!player || typeof player.getCurrentTime !== 'function') return;

              const curr = player.getCurrentTime();
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                onSyncAction('play', curr);
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                onSyncAction('pause', curr);
              }
            },
          },
        });
      } catch (err) {
        console.error('Error initializing YouTube player:', err);
      }
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initYT();
      };
    } else {
      initYT();
    }

    // Passive seek monitor
    const interval = setInterval(() => {
      const player = ytPlayerRef.current;
      if (!player || isIncomingSyncRef.current || typeof player.getPlayerState !== 'function') return;

      const state = player.getPlayerState();
      const curr = player.getCurrentTime();
      setCurrentTime(curr);

      if (state === window.YT?.PlayerState?.PLAYING) {
        const drift = Math.abs(curr - (lastTimeRef.current + 0.5));
        if (drift > 2.0) {
          onSyncAction('seek', curr);
        }
      } else if (state === window.YT?.PlayerState?.PAUSED) {
        const drift = Math.abs(curr - lastTimeRef.current);
        if (drift > 1.2) {
          onSyncAction('seek', curr);
        }
      }
      lastTimeRef.current = curr;
    }, 500);

    return () => {
      destroyed = true;
      clearInterval(interval);
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch {}
        ytPlayerRef.current = null;
      }
    };
  }, [platform, videoId]);

  // When YouTube videoId changes, cue/load it
  useEffect(() => {
    if (platform === 'youtube' && ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
      isIncomingSyncRef.current = true;
      ytPlayerRef.current.loadVideoById(videoId, 0);
      setTimeout(() => {
        isIncomingSyncRef.current = false;
      }, 800);
    }
  }, [videoId, platform]);

  // Handle incoming sync packets
  useEffect(() => {
    if (!incomingSync) return;
    const { action, time } = incomingSync;
    isIncomingSyncRef.current = true;

    if (platform === 'youtube') {
      const player = ytPlayerRef.current;
      if (player && typeof player.seekTo === 'function') {
        if (action === 'play') {
          player.seekTo(time, true);
          player.playVideo();
          setIsPlaying(true);
        } else if (action === 'pause') {
          player.seekTo(time, true);
          player.pauseVideo();
          setIsPlaying(false);
        } else if (action === 'seek') {
          player.seekTo(time, true);
        }
      }
    } else if (platform === 'vk') {
      // VK postMessage communication
      const iframe = vkIframeRef.current;
      if (iframe && iframe.contentWindow) {
        try {
          if (action === 'play') {
            iframe.contentWindow.postMessage(JSON.stringify({ method: 'play' }), '*');
            setIsPlaying(true);
          } else if (action === 'pause') {
            iframe.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*');
            setIsPlaying(false);
          } else if (action === 'seek') {
            iframe.contentWindow.postMessage(JSON.stringify({ method: 'seek', time: time }), '*');
          }
        } catch (e) {
          console.warn('VK postMessage error:', e);
        }
      }
    }

    setTimeout(() => {
      isIncomingSyncRef.current = false;
    }, 800);
  }, [incomingSync, platform]);

  // VK manual controls trigger
  const handleVkControl = (action: 'play' | 'pause' | 'seek', time = 0) => {
    const iframe = vkIframeRef.current;
    if (iframe && iframe.contentWindow) {
      try {
        if (action === 'play') {
          iframe.contentWindow.postMessage(JSON.stringify({ method: 'play' }), '*');
          setIsPlaying(true);
        } else if (action === 'pause') {
          iframe.contentWindow.postMessage(JSON.stringify({ method: 'pause' }), '*');
          setIsPlaying(false);
        } else if (action === 'seek') {
          iframe.contentWindow.postMessage(JSON.stringify({ method: 'seek', time }), '*');
        }
      } catch {}
    }
    onSyncAction(action, time);
  };

  // Build VK Embed URL
  const getVkUrl = () => {
    let oid = vkOid;
    let id = vkId;
    if (!oid || !id) {
      const parts = videoId.split('_');
      if (parts.length === 2) {
        oid = parts[0];
        id = parts[1];
      } else {
        oid = '-22822305';
        id = '456241984';
      }
    }
    let url = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2&autoplay=0&js_api=1`;
    if (vkHash) {
      url += `&hash=${vkHash}`;
    }
    return url;
  };

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl flex flex-col group">
      {/* Active Platform watermark */}
      <div className="absolute top-3 right-3 z-20 pointer-events-none flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-[11px] font-semibold text-neutral-300">
        {platform === 'youtube' ? (
          <>
            <PlayCircle className="w-3.5 h-3.5 text-red-500" />
            <span>YouTube</span>
          </>
        ) : (
          <>
            <Tv className="w-3.5 h-3.5 text-blue-400" />
            <span>VK Видео</span>
          </>
        )}
      </div>

      {/* Video Viewport */}
      <div className="w-full h-full relative" ref={containerRef}>
        {platform === 'youtube' ? (
          <div id="yt-player-target" className="w-full h-full" />
        ) : (
          <div className="w-full h-full relative bg-neutral-950 flex flex-col">
            <iframe
              ref={vkIframeRef}
              src={getVkUrl()}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock;"
              allowFullScreen
              title="VK Video Player"
            />

            {/* Quick VK sync controls toolbar for host & participants */}
            <div className="absolute bottom-2 left-2 right-2 z-20 bg-black/75 backdrop-blur-md border border-white/10 rounded-lg p-2 flex items-center justify-between text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleVkControl(isPlaying ? 'pause' : 'play', 0)}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  {isPlaying ? 'Пауза всем' : 'Воспроизведение всем'}
                </button>
                <button
                  type="button"
                  onClick={() => handleVkControl('seek', 0)}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded flex items-center gap-1 cursor-pointer"
                  title="В начало"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  В начало
                </button>
              </div>

              <span className="text-[11px] text-neutral-400 hidden sm:inline">
                Синхронизация VK Видео активна
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
