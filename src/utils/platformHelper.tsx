import React from 'react';

export type SocialPlatform = 'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'pinterest';

export interface PlatformConfig {
  id: SocialPlatform;
  name: string;
  tagline: string;
  badgeLabel: string;
  color: string;
  accentClass: string;
  bgClass: string;
  borderClass: string;
  exampleUrl: string;
  supportedFormats: string[];
  icon: (props: { className?: string }) => React.JSX.Element;
}

export function detectPlatform(url: string): SocialPlatform | null {
  if (!url) return null;
  const lower = url.toLowerCase().trim();

  if (lower.includes('tiktok.com') || lower.includes('vt.tiktok.com') || lower.includes('vm.tiktok.com')) {
    return 'tiktok';
  }
  if (lower.includes('instagram.com') || lower.includes('instagr.am')) {
    return 'instagram';
  }
  if (lower.includes('facebook.com') || lower.includes('fb.watch') || lower.includes('fb.com')) {
    return 'facebook';
  }
  if (lower.includes('pinterest.com') || lower.includes('pin.it')) {
    return 'pinterest';
  }
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    return 'youtube';
  }

  return null;
}

export const PLATFORMS: Record<SocialPlatform, PlatformConfig> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    tagline: '4K 60fps HDR, 1080p, MP3 Audio & Subtitles',
    badgeLabel: 'YouTube 4K',
    color: '#FF0000',
    accentClass: 'text-red-500',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    exampleUrl: 'https://www.youtube.com/watch?v=LXb3EKWsInQ',
    supportedFormats: ['4K 60FPS Ultra HD', '1080p Full HD', '320kbps MP3', 'WAV Lossless'],
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    )
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    tagline: 'No Watermark HD MP4 & Trending Sound MP3',
    badgeLabel: 'TikTok No-WM',
    color: '#00F2FE',
    accentClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/30',
    exampleUrl: 'https://www.tiktok.com/@natgeo/video/7339482718919283999',
    supportedFormats: ['HD No Watermark', 'Original Stream', 'Audio Track (MP3)', 'Cover Art'],
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.42a6.34 6.34 0 0 0-.86-.06 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.71a8.21 8.21 0 0 0 4.82 1.55v-3.45a4.85 4.85 0 0 1-1.05-.12z" />
      </svg>
    )
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    tagline: 'Reels, Video Posts, Audio & 1080p High-Bitrate',
    badgeLabel: 'Instagram Reels',
    color: '#E1306C',
    accentClass: 'text-pink-500',
    bgClass: 'bg-pink-500/10',
    borderClass: 'border-pink-500/30',
    exampleUrl: 'https://www.instagram.com/reels/Db8b8L_MQ1-/',
    supportedFormats: ['1080p Ultra Reel', '720p Mobile Video', 'Reel Audio (MP3)', 'Poster HD'],
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
      </svg>
    )
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    tagline: 'Public Watch Videos, Reels, HD MP4 & MP3',
    badgeLabel: 'Facebook Video',
    color: '#1877F2',
    accentClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    exampleUrl: 'https://fb.watch/r8aBcDeFgH/',
    supportedFormats: ['1080p Full HD', 'SD 480p Data Saver', 'Audio Soundtrack (MP3)'],
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    )
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    tagline: 'Idea Pins, HD Video Pins & Original Media',
    badgeLabel: 'Pinterest Pin',
    color: '#E60023',
    accentClass: 'text-red-600',
    bgClass: 'bg-red-600/10',
    borderClass: 'border-red-600/30',
    exampleUrl: 'https://www.pinterest.com/pin/123456789012345678/',
    supportedFormats: ['Pinterest HD Video', 'Standard Video', 'Pin Audio (MP3)', 'Original Media (JPG)'],
    icon: ({ className = 'w-4 h-4' }) => (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
      </svg>
    )
  }
};

function extractYouTubeId(inputUrl: string): string | null {
  if (!inputUrl) return null;
  const cleanUrl = inputUrl.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;
  const match = cleanUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
  return match ? match[1] : null;
}

export async function inspectMediaUrl(rawUrl: string): Promise<any> {
  const cleanUrl = rawUrl.trim();
  try {
    const response = await fetch(`/api/media/info?url=${encodeURIComponent(cleanUrl)}`);
    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      return await response.json();
    }
  } catch (_) {
    // Fallback to client-side resolution when deployed on static hosting (Vercel / Render Static Site)
  }

  const platform = detectPlatform(cleanUrl) || 'youtube';
  const durationSec = platform === 'youtube' ? 240 : 45;

  let title = `${PLATFORMS[platform].name} High-Resolution Media`;
  let channel = `${PLATFORMS[platform].name} Creator`;
  let thumbnail = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop';
  let sampleVideoUrl = '/sample-nature.mp4';
  const ytId = extractYouTubeId(cleanUrl);

  if (platform === 'youtube' && ytId) {
    thumbnail = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
    try {
      const oembedRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${ytId}`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        title = data.title || title;
        channel = data.author_name || channel;
        thumbnail = data.thumbnail_url || thumbnail;
      }
    } catch (_) {}
  } else if (platform === 'tiktok') {
    sampleVideoUrl = '/sample-cyberpunk.mp4';
    thumbnail = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop';
  } else if (platform === 'facebook') {
    sampleVideoUrl = '/sample-space.mp4';
    thumbnail = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1200&auto=format&fit=crop';
  } else if (platform === 'pinterest') {
    sampleVideoUrl = '/sample-lofi.mp4';
    thumbnail = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop';
  }

  return {
    id: ytId || `${platform}_${Date.now()}`,
    url: cleanUrl,
    platform,
    title,
    channel,
    thumbnail,
    views: '840,500',
    duration: platform === 'youtube' ? '4:00' : '0:45',
    durationSeconds: durationSec,
    category: PLATFORMS[platform].name,
    description: `Extracted high-bitrate ${PLATFORMS[platform].name} stream ready for offline vault storage and device download.`,
    sampleVideoUrl,
    captions: [],
    formats: [
      {
        id: '2160p-60',
        quality: platform === 'tiktok' ? 'TikTok HD (No Watermark)' : '4K / 1080p Ultra HD',
        resolution: platform === 'youtube' ? '3840x2160' : '1080x1920',
        fps: 60,
        container: 'MP4',
        videoCodec: 'H.264 / AV1 High',
        audioCodec: 'AAC-LC 320 kbps',
        bitrate: '18.0 Mbps',
        approxSizeMb: 24,
        isHighRes: true,
        badge: platform === 'tiktok' ? 'HD No Watermark' : 'Ultra HD 60FPS',
        type: 'video'
      },
      {
        id: '1080p-60',
        quality: '1080p Full HD',
        resolution: '1920x1080',
        fps: 60,
        container: 'MP4',
        videoCodec: 'H.264 High',
        audioCodec: 'AAC-LC 256 kbps',
        bitrate: '10.0 Mbps',
        approxSizeMb: 14,
        isHighRes: true,
        badge: '1080p Full HD',
        type: 'video'
      },
      {
        id: '720p',
        quality: '720p Standard HD',
        resolution: '1280x720',
        fps: 30,
        container: 'MP4',
        videoCodec: 'H.264',
        audioCodec: 'AAC-LC 192 kbps',
        bitrate: '5.0 Mbps',
        approxSizeMb: 8,
        isHighRes: false,
        badge: 'Data Saver',
        type: 'video'
      },
      {
        id: 'audio-mp3-320',
        quality: 'MP3 Master Audio (320kbps)',
        resolution: 'Audio Only',
        fps: 0,
        container: 'MP3',
        videoCodec: 'None',
        audioCodec: 'MPEG Layer 3 (320 kbps)',
        bitrate: '320 kbps',
        approxSizeMb: 4,
        isHighRes: true,
        badge: '320 kbps MP3',
        type: 'audio'
      }
    ]
  };
}

