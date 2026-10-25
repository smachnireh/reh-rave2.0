import { VideoPlatform } from '../types';

export interface ParsedVideo {
  platform: VideoPlatform;
  id: string; // YouTube video ID or VK oid_id
  rawUrl?: string;
  embedUrl: string;
  oid?: string;
  vkId?: string;
  hash?: string;
}

/**
 * Extract YouTube ID
 */
export function extractYouTubeId(input: string): string | null {
  const url = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  // Handle standard youtu.be or youtube.com/watch?v= or embed/
  const standardMatch = url.match(/^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
  if (standardMatch && standardMatch[2] && standardMatch[2].length === 11) {
    return standardMatch[2];
  }

  // Handle shorts
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch && shortsMatch[1]) {
    return shortsMatch[1];
  }

  return null;
}

/**
 * Extract VK Video info
 * Supported formats:
 * - https://vk.com/video-22822305_456241984
 * - https://vkvideo.ru/video-22822305_456241984
 * - https://vk.com/video_ext.php?oid=-22822305&id=456241984&hash=xxx
 * - <iframe src="https://vk.com/video_ext.php?oid=-22822305&id=456241984&hash=xxx" ...>
 * - -22822305_456241984
 */
export function extractVkVideo(input: string): { oid: string; vkId: string; hash?: string } | null {
  const text = input.trim();

  // If iframe tag, extract src
  let target = text;
  const iframeSrcMatch = text.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch) {
    target = iframeSrcMatch[1];
  }

  // video_ext.php format
  if (target.includes('video_ext.php')) {
    try {
      const urlObj = new URL(target.startsWith('//') ? 'https:' + target : target);
      const oid = urlObj.searchParams.get('oid');
      const id = urlObj.searchParams.get('id');
      const hash = urlObj.searchParams.get('hash') || undefined;
      if (oid && id) {
        return { oid, vkId: id, hash };
      }
    } catch {
      // Manual regex fallback
      const oidMatch = target.match(/oid=(-?\d+)/);
      const idMatch = target.match(/id=(\d+)/);
      const hashMatch = target.match(/hash=([a-zA-Z0-9]+)/);
      if (oidMatch && idMatch) {
        return { oid: oidMatch[1], vkId: idMatch[1], hash: hashMatch ? hashMatch[1] : undefined };
      }
    }
  }

  // /video-123_456 or /video123_456
  const videoMatch = target.match(/\/video(-?\d+)_(\d+)/);
  if (videoMatch) {
    return { oid: videoMatch[1], vkId: videoMatch[2] };
  }

  // Direct format: -123_456 or 123_456
  const directMatch = target.match(/^(-?\d+)_(\d+)$/);
  if (directMatch) {
    return { oid: directMatch[1], vkId: directMatch[2] };
  }

  return null;
}

/**
 * Build VK embed URL with API enabled
 */
export function buildVkEmbedUrl(oid: string, id: string, hash?: string): string {
  let url = `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2&autoplay=0&js_api=1`;
  if (hash) {
    url += `&hash=${hash}`;
  }
  return url;
}

/**
 * Universal video parser
 */
export function parseVideoUrl(input: string, preferredPlatform: VideoPlatform = 'youtube'): ParsedVideo | null {
  const clean = input.trim();
  if (!clean) return null;

  // Check if VK explicitly
  if (clean.includes('vk.com') || clean.includes('vkvideo.ru') || clean.includes('video_ext.php')) {
    const vk = extractVkVideo(clean);
    if (vk) {
      return {
        platform: 'vk',
        id: `${vk.oid}_${vk.vkId}`,
        oid: vk.oid,
        vkId: vk.vkId,
        hash: vk.hash,
        embedUrl: buildVkEmbedUrl(vk.oid, vk.vkId, vk.hash),
        rawUrl: clean,
      };
    }
  }

  // Check if YouTube
  const ytId = extractYouTubeId(clean);
  if (ytId) {
    return {
      platform: 'youtube',
      id: ytId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`,
      rawUrl: clean,
    };
  }

  // If user entered direct oid_id or preferred platform is VK
  if (preferredPlatform === 'vk') {
    const vk = extractVkVideo(clean);
    if (vk) {
      return {
        platform: 'vk',
        id: `${vk.oid}_${vk.vkId}`,
        oid: vk.oid,
        vkId: vk.vkId,
        hash: vk.hash,
        embedUrl: buildVkEmbedUrl(vk.oid, vk.vkId, vk.hash),
        rawUrl: clean,
      };
    }
  }

  return null;
}

/**
 * Quick Presets to test immediately without searching
 */
export const PRESET_VIDEOS = {
  youtube: [
    { title: 'Lofi Hip Hop Radio / Beats', id: 'jfKfPfyJRdk', platform: 'youtube' as VideoPlatform },
    { title: 'Synthwave / Retrowave Chill', id: '4xDzrJKXOOY', platform: 'youtube' as VideoPlatform },
    { title: 'Rick Astley — Never Gonna Give You Up', id: 'dQw4w9WgXcQ', platform: 'youtube' as VideoPlatform },
    { title: '4K Природа и Релакс', id: 'LXb3EKWsInQ', platform: 'youtube' as VideoPlatform },
  ],
  vk: [
    {
      title: 'VK Видео — Трейлер / Шоу',
      id: '-22822305_456241984',
      oid: '-22822305',
      vkId: '456241984',
      platform: 'vk' as VideoPlatform,
    },
    {
      title: 'VK Музыка & Клипы (Официальный)',
      id: '-28363549_456239106',
      oid: '-28363549',
      vkId: '456239106',
      platform: 'vk' as VideoPlatform,
    },
    {
      title: 'VK Наука и Космос',
      id: '-47045009_456241031',
      oid: '-47045009',
      vkId: '456241031',
      platform: 'vk' as VideoPlatform,
    },
  ],
};
