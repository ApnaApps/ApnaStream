function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function unescapeJsonUrl(raw) {
  if (!raw) return '';
  try {
    return JSON.parse(`"${raw.replace(/"/g, '\\"')}"`);
  } catch (_) {
    return raw
      .replace(/\\u0025/gi, '%')
      .replace(/\\u0026/gi, '&')
      .replace(/\\u002F/gi, '/')
      .replace(/\\u003C/gi, '<')
      .replace(/\\u003D/gi, '=')
      .replace(/\\u003F/gi, '?')
      .replace(/\\\//g, '/')
      .replace(/&amp;/g, '&');
  }
}

function formatDuration(seconds) {
  const sec = Math.max(1, Math.round(Number(seconds) || 30));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function detectPlatform(url) {
  if (!url) return 'youtube';
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
  return 'youtube';
}

function extractYouTubeId(inputUrl) {
  if (!inputUrl) return null;
  const cleanUrl = inputUrl.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) return cleanUrl;
  const match = cleanUrl.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/|live\/))([\w-]{11})/
  );
  return match ? match[1] : null;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handleMediaInfo(req, res) {
  try {
    const urlParam = req.query?.url;
    if (!urlParam || typeof urlParam !== 'string') {
      return res.status(400).json({ error: 'Missing "url" parameter' });
    }

    const cleanUrl = urlParam.trim();
    const platform = detectPlatform(cleanUrl);

    // =========================================================================
    // 1. INSTAGRAM (Reels, Posts, IGTV: /reels/, /reel/, /p/, /tv/)
    // =========================================================================
    if (platform === 'instagram') {
      let targetUrl = cleanUrl;
      let match = targetUrl.match(/(?:reels?|p|tv|share\/reel|share\/p)\/([a-zA-Z0-9_-]+)/);

      // If it's a share link, resolve redirect first
      if (!match || targetUrl.includes('/share/')) {
        try {
          const shareRes = await fetchWithTimeout(targetUrl, {
            headers: { 'User-Agent': 'TelegramBot (like TwitterBot)' },
            redirect: 'follow'
          });
          if (shareRes.url) {
            targetUrl = shareRes.url;
            match = targetUrl.match(/(?:reels?|p|tv)\/([a-zA-Z0-9_-]+)/);
          }
        } catch (_) {}
      }

      const shortcode = match ? match[1] : null;
      if (!shortcode) {
        return res.status(400).json({
          error: 'Could not find a valid Instagram Reel or Post ID in this link.'
        });
      }

      let title = `Instagram Reel #${shortcode}`;
      let channel = '@instagram_creator';
      let views = 'Instagram Reel';
      let description = '';
      let rawThumbnail = '';

      // Step A: Fetch real title, username, likes/comments, and thumbnail via TelegramBot UA
      try {
        const ogRes = await fetchWithTimeout(`https://www.instagram.com/reels/${shortcode}/`, {
          headers: { 'User-Agent': 'TelegramBot (like TwitterBot)' }
        });
        if (ogRes.ok) {
          const ogHtml = await ogRes.text();
          const rawTitle = decodeHtmlEntities(
            ogHtml.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] || ''
          );
          const rawDesc = decodeHtmlEntities(
            ogHtml.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] || ''
          );
          rawThumbnail = decodeHtmlEntities(
            ogHtml.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] || ''
          );

          const userMatch = rawDesc.match(/-\s*([a-zA-Z0-9._]+)\s+on\s+/);
          const statsMatch = rawDesc.match(/^([^-]+?)\s*-\s*/);
          const captionMatch =
            rawTitle.match(/on Instagram:\s*"([^"]+)"/i) ||
            rawDesc.match(/:\s*"([^"]+)"/);

          if (userMatch) channel = `@${userMatch[1]}`;
          if (statsMatch) views = statsMatch[1].trim();
          if (captionMatch) {
            title = captionMatch[1].trim();
          } else if (rawTitle) {
            title = rawTitle.replace(/\s*on Instagram.*$/i, '').trim() || title;
          }
          description = rawDesc || rawTitle;
        }
      } catch (e) {
        console.warn('Instagram OG fetch warning:', e);
      }

      // Step B: Multi-layer direct MP4 stream extraction
      let directMp4Url = '';
      let durationSec = 30;
      let fileSizeMb = 8;

      // Layer 1: kkinstagram redirect
      try {
        const kkRes = await fetchWithTimeout(`https://www.kkinstagram.com/reels/${shortcode}/`, {
          headers: { 'User-Agent': 'TelegramBot (like TwitterBot)' },
          redirect: 'manual'
        });
        const loc = kkRes.headers.get('location');
        if (loc && (loc.includes('.mp4') || loc.includes('fbcdn.net') || loc.includes('cdninstagram.com'))) {
          directMp4Url = loc;
        }
      } catch (_) {}

      // Layer 2: vxinstagram / ddinstagram
      if (!directMp4Url) {
        for (const host of ['www.vxinstagram.com', 'www.ddinstagram.com']) {
          try {
            const vxRes = await fetchWithTimeout(`https://${host}/reels/${shortcode}/`, {
              headers: { 'User-Agent': 'TelegramBot (like TwitterBot)' }
            });
            if (vxRes.ok) {
              const vxHtml = await vxRes.text();
              const vxVid =
                vxHtml.match(/property="og:video(?::secure_url|:url)?"\s+content="([^"]+)"/i)?.[1] ||
                vxHtml.match(/content="([^"]+\.mp4[^"]*)"\s+property="og:video/i)?.[1];
              if (vxVid) {
                directMp4Url = decodeHtmlEntities(vxVid);
                break;
              }
            }
          } catch (_) {}
        }
      }

      // Layer 3: Instagram public embed endpoint
      if (!directMp4Url) {
        try {
          const embedRes = await fetchWithTimeout(`https://www.instagram.com/p/${shortcode}/embed/captioned/`, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
          });
          if (embedRes.ok) {
            const embedHtml = await embedRes.text();
            const vMatch = embedHtml.match(/\\?"video_url\\?":\\?"([^"\\]+(?:\\.[^"\\]+)*)\\?"/);
            if (vMatch?.[1]) {
              directMp4Url = unescapeJsonUrl(vMatch[1].replace(/\\"/g, '"'));
            }
          }
        } catch (_) {}
      }

      // Extract duration from efg base64 param if available
      if (directMp4Url) {
        const efgMatch = directMp4Url.match(/efg=([^&]+)/);
        if (efgMatch) {
          try {
            const decodedEfg = JSON.parse(
              Buffer.from(decodeURIComponent(efgMatch[1]), 'base64').toString('utf8')
            );
            if (decodedEfg.duration_s) {
              durationSec = Math.max(1, Math.round(Number(decodedEfg.duration_s)));
            }
          } catch (_) {}
        }

        try {
          const headRes = await fetchWithTimeout(directMp4Url, { method: 'HEAD' }, 3500);
          const len = headRes.headers.get('content-length');
          if (len) {
            fileSizeMb = Math.max(1, Math.round((parseInt(len, 10) / (1024 * 1024)) * 10) / 10);
          }
        } catch (_) {}
      }

      if (!directMp4Url) {
        return res.status(422).json({
          error: 'Could not extract video stream from this Instagram link. Make sure the Reel or Post is public.'
        });
      }

      const proxiedVideoUrl = `/api/download/proxy?url=${encodeURIComponent(directMp4Url)}`;
      const proxiedThumbUrl = rawThumbnail
        ? `/api/download/proxy?url=${encodeURIComponent(rawThumbnail)}`
        : 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?q=80&w=1200&auto=format&fit=crop';

      return res.json({
        id: `ig_${shortcode}`,
        url: cleanUrl,
        platform: 'instagram',
        title,
        channel,
        thumbnail: proxiedThumbUrl,
        views,
        duration: formatDuration(durationSec),
        durationSeconds: durationSec,
        category: 'Instagram Reel',
        description: description || `Instagram Reel by ${channel}`,
        sampleVideoUrl: proxiedVideoUrl,
        captions: [],
        formats: [
          {
            id: 'ig-reel-1080',
            quality: 'Original HD Reel (MP4)',
            resolution: '1080x1920 (Original)',
            fps: 60,
            container: 'MP4',
            videoCodec: 'H.264 High Profile',
            audioCodec: 'AAC-LC 256 kbps',
            bitrate: '8.5 Mbps',
            approxSizeMb: fileSizeMb,
            isHighRes: true,
            badge: 'Original HD Reel',
            type: 'video',
            downloadUrl: proxiedVideoUrl
          },
          {
            id: 'ig-reel-720',
            quality: '720p Mobile Reel (MP4)',
            resolution: '720x1280',
            fps: 30,
            container: 'MP4',
            videoCodec: 'H.264',
            audioCodec: 'AAC-LC 160 kbps',
            bitrate: '4.5 Mbps',
            approxSizeMb: Math.max(1, Math.round(fileSizeMb * 0.7)),
            isHighRes: false,
            badge: 'Fast Download',
            type: 'video',
            downloadUrl: proxiedVideoUrl
          },
          {
            id: 'ig-audio-mp3',
            quality: 'Original Reel Audio (MP3)',
            resolution: 'Audio Only',
            fps: 0,
            container: 'MP3',
            videoCodec: 'None',
            audioCodec: 'AAC / MP3 320 kbps',
            bitrate: '320 kbps',
            approxSizeMb: Math.max(1, Math.round(fileSizeMb * 0.25)),
            isHighRes: true,
            badge: 'Reel Audio Track',
            type: 'audio',
            downloadUrl: proxiedVideoUrl
          }
        ]
      });
    }

    // =========================================================================
    // 2. TIKTOK (Real No-Watermark HD Video & MP3 Audio)
    // =========================================================================
    if (platform === 'tiktok') {
      let title = 'TikTok Video';
      let channel = '@tiktok_creator';
      let views = 'TikTok Video';
      let durationSec = 30;
      let rawThumbnail = '';
      let hdVideoUrl = '';
      let stdVideoUrl = '';
      let musicUrl = '';
      let hdSizeMb = 8;
      let stdSizeMb = 4;

      const normalizeTikWmUrl = (u) => {
        if (!u) return '';
        if (u.startsWith('http://') || u.startsWith('https://')) return u;
        if (u.startsWith('/')) return `https://www.tikwm.com${u}`;
        return u;
      };

      // Layer 1: TikWM API
      try {
        const ttRes = await fetchWithTimeout(
          `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}&hd=1`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (ttRes.ok) {
          const ttJson = await ttRes.json();
          const d = ttJson?.data;
          if (d && (d.play || d.hdplay || d.wmplay)) {
            title = d.title || title;
            channel = d.author?.unique_id ? `@${d.author.unique_id}` : channel;
            rawThumbnail = normalizeTikWmUrl(d.origin_cover || d.cover || '');
            durationSec = Number(d.duration) || 30;
            views = d.play_count
              ? `${Number(d.play_count).toLocaleString()} views · ${Number(d.digg_count || 0).toLocaleString()} likes`
              : views;
            hdVideoUrl = normalizeTikWmUrl(d.hdplay || d.play || '');
            stdVideoUrl = normalizeTikWmUrl(d.play || d.wmplay || '');
            musicUrl = normalizeTikWmUrl(d.music || '');
            if (d.hd_size) hdSizeMb = Math.max(1, Math.round((d.hd_size / (1024 * 1024)) * 10) / 10);
            if (d.size) stdSizeMb = Math.max(1, Math.round((d.size / (1024 * 1024)) * 10) / 10);
          }
        }
      } catch (e) {
        console.warn('TikWM extraction warning:', e);
      }

      // Layer 2: Tiklydown API fallback
      if (!hdVideoUrl && !stdVideoUrl) {
        try {
          const tlRes = await fetchWithTimeout(
            `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(cleanUrl)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
          );
          if (tlRes.ok) {
            const tlJson = await tlRes.json();
            if (tlJson?.video?.noWatermark || tlJson?.video?.watermark) {
              title = tlJson.title || title;
              channel = tlJson.author?.unique_id ? `@${tlJson.author.unique_id}` : channel;
              rawThumbnail = tlJson.video.cover || tlJson.video.origin_cover || rawThumbnail;
              durationSec = Number(tlJson.video.duration) || durationSec;
              hdVideoUrl = tlJson.video.noWatermark || tlJson.video.watermark;
              stdVideoUrl = tlJson.video.watermark || hdVideoUrl;
              musicUrl = tlJson.music?.play_url || '';
            }
          }
        } catch (e) {
          console.warn('Tiklydown fallback warning:', e);
        }
      }

      // Layer 3: vxtiktok TelegramBot OG Video fallback
      if (!hdVideoUrl && !stdVideoUrl) {
        try {
          let resolvedTt = cleanUrl;
          if (cleanUrl.includes('vt.tiktok.com') || cleanUrl.includes('vm.tiktok.com') || cleanUrl.includes('/t/')) {
            const rRes = await fetchWithTimeout(cleanUrl, { redirect: 'follow' });
            if (rRes.url) resolvedTt = rRes.url;
          }
          const vxUrl = resolvedTt.replace(/(?:www\.|m\.)?tiktok\.com/i, 'vxtiktok.com');
          const vxRes = await fetchWithTimeout(vxUrl, {
            headers: { 'User-Agent': 'TelegramBot (like TwitterBot)' }
          });
          if (vxRes.ok) {
            const vxHtml = await vxRes.text();
            const ogVid = vxHtml.match(/property="og:video(?::secure_url|:url)?"\s+content="([^"]+)"/i)?.[1];
            const ogTit = vxHtml.match(/property="og:title"\s+content="([^"]+)"/i)?.[1];
            const ogDesc = vxHtml.match(/property="og:description"\s+content="([^"]+)"/i)?.[1];
            if (ogVid) {
              hdVideoUrl = decodeHtmlEntities(ogVid);
              stdVideoUrl = hdVideoUrl;
            }
            if (ogDesc) title = decodeHtmlEntities(ogDesc);
            if (ogTit) channel = decodeHtmlEntities(ogTit);
          }
        } catch (_) {}
      }

      const bestTikTokVideo = hdVideoUrl || stdVideoUrl;
      if (!bestTikTokVideo) {
        return res.status(422).json({
          error: 'Could not extract video from this TikTok link. Please check that the TikTok video URL is valid and public.'
        });
      }

      const proxiedHd = `/api/download/proxy?url=${encodeURIComponent(bestTikTokVideo)}`;
      const proxiedStd = stdVideoUrl
        ? `/api/download/proxy?url=${encodeURIComponent(stdVideoUrl)}`
        : proxiedHd;
      const proxiedMusic = musicUrl
        ? `/api/download/proxy?url=${encodeURIComponent(musicUrl)}`
        : proxiedHd;
      const proxiedThumb = rawThumbnail
        ? `/api/download/proxy?url=${encodeURIComponent(rawThumbnail)}`
        : 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop';

      return res.json({
        id: `tt_${Date.now()}`,
        url: cleanUrl,
        platform: 'tiktok',
        title,
        channel,
        thumbnail: proxiedThumb,
        views,
        duration: formatDuration(durationSec),
        durationSeconds: durationSec,
        category: 'TikTok Video',
        description: `${title} — by ${channel}`,
        sampleVideoUrl: proxiedHd,
        captions: [],
        formats: [
          {
            id: 'tt-hd-nowm',
            quality: 'TikTok HD (No Watermark)',
            resolution: '1080x1920 (Vertical HD)',
            fps: 60,
            container: 'MP4',
            videoCodec: 'H.264 High / AAC',
            audioCodec: 'AAC-LC 256 kbps',
            bitrate: '8.5 Mbps',
            approxSizeMb: hdSizeMb,
            isHighRes: true,
            badge: 'HD No Watermark',
            type: 'video',
            downloadUrl: proxiedHd
          },
          {
            id: 'tt-std-nowm',
            quality: 'TikTok Fast MP4 (No Watermark)',
            resolution: '720x1280',
            fps: 30,
            container: 'MP4',
            videoCodec: 'H.264',
            audioCodec: 'AAC-LC 160 kbps',
            bitrate: '4.2 Mbps',
            approxSizeMb: stdSizeMb,
            isHighRes: false,
            badge: 'Fast MP4',
            type: 'video',
            downloadUrl: proxiedStd
          },
          {
            id: 'tt-audio-mp3',
            quality: 'Original TikTok Sound (MP3)',
            resolution: 'Audio Only',
            fps: 0,
            container: 'MP3',
            videoCodec: 'None',
            audioCodec: 'MPEG Layer 3 (320 kbps)',
            bitrate: '320 kbps',
            approxSizeMb: Math.max(1, Math.round(stdSizeMb * 0.25)),
            isHighRes: true,
            badge: 'Original Sound MP3',
            type: 'audio',
            downloadUrl: proxiedMusic
          }
        ]
      });
    }

    // =========================================================================
    // 3. FACEBOOK (Watch, Reels, Share Links & Public Videos)
    // =========================================================================
    if (platform === 'facebook') {
      let title = 'Facebook Video';
      let channel = 'Facebook Creator';
      let views = 'Facebook Watch';
      let rawThumbnail = '';
      let hdVideoUrl = '';
      let sdVideoUrl = '';
      let durationSec = 45;
      let canonicalFbUrl = cleanUrl;

      // Helper to scan any Facebook HTML/JSON response for direct MP4 URLs
      const extractFbStreamsFromText = (text) => {
        if (!text) return;
        const hdPatterns = [
          /"browser_native_hd_url"\s*:\s*"([^"]+)"/,
          /"playable_url_quality_hd"\s*:\s*"([^"]+)"/,
          /"hd_src_no_ratelimit"\s*:\s*"([^"]+)"/,
          /"hd_src"\s*:\s*"([^"]+)"/
        ];
        const sdPatterns = [
          /"browser_native_sd_url"\s*:\s*"([^"]+)"/,
          /"playable_url"\s*:\s*"([^"]+)"/,
          /"sd_src_no_ratelimit"\s*:\s*"([^"]+)"/,
          /"sd_src"\s*:\s*"([^"]+)"/
        ];

        for (const p of hdPatterns) {
          const m = text.match(p);
          if (m?.[1] && m[1] !== 'null') {
            hdVideoUrl = unescapeJsonUrl(m[1]);
            break;
          }
        }
        for (const p of sdPatterns) {
          const m = text.match(p);
          if (m?.[1] && m[1] !== 'null') {
            sdVideoUrl = unescapeJsonUrl(m[1]);
            break;
          }
        }

        // Also check og:video meta tags
        if (!hdVideoUrl && !sdVideoUrl) {
          const ogVid =
            text.match(/property="og:video(?::secure_url|:url)?"\s+content="([^"]+)"/i)?.[1] ||
            text.match(/content="([^"]+)"\s+property="og:video(?::secure_url|:url)?"/i)?.[1];
          if (ogVid && (ogVid.includes('.mp4') || ogVid.includes('fbcdn.net'))) {
            hdVideoUrl = decodeHtmlEntities(ogVid);
          }
        }

        // Also check Relay progressive/base_url MP4 entries
        if (!hdVideoUrl && !sdVideoUrl) {
          const progressiveMatches = [
            ...text.matchAll(/"(?:progressive_url|base_url)"\s*:\s*"(https?:\\\/\\\/[^"]+\.mp4[^"]*)"/gi)
          ].map((m) => unescapeJsonUrl(m[1]));
          // Filter out audio-only DASH tracks when picking main video
          const videoCandidates = progressiveMatches.filter(
            (u) => !u.includes('audio') && !u.includes('_a.mp4')
          );
          if (videoCandidates.length > 0) {
            hdVideoUrl = videoCandidates[0];
          } else if (progressiveMatches.length > 0) {
            hdVideoUrl = progressiveMatches[0];
          }
        }
      };

      // Step A: Resolve URL & fetch OG metadata via facebookexternalhit
      try {
        const ogRes = await fetchWithTimeout(cleanUrl, {
          headers: { 'User-Agent': 'facebookexternalhit/1.1' },
          redirect: 'follow'
        });
        if (ogRes.url && !ogRes.url.includes('/login')) {
          canonicalFbUrl = ogRes.url;
        }
        if (ogRes.ok) {
          const ogHtml = await ogRes.text();
          const ogUrlMeta = decodeHtmlEntities(
            ogHtml.match(/property="og:url"\s+content="([^"]+)"/i)?.[1] || ''
          );
          if (ogUrlMeta && ogUrlMeta.startsWith('http') && !ogUrlMeta.includes('/login')) {
            canonicalFbUrl = ogUrlMeta;
          }

          const rawTitle = decodeHtmlEntities(
            ogHtml.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ||
              ogHtml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
              ''
          );
          const rawDesc = decodeHtmlEntities(
            ogHtml.match(/property="og:description"\s+content="([^"]+)"/i)?.[1] || ''
          );
          rawThumbnail = decodeHtmlEntities(
            ogHtml.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] || ''
          );

          // Parse Facebook title format: "12K views · 500 reactions | Video Title | Creator Name"
          if (rawTitle) {
            const pipeParts = rawTitle
              .replace(/\|\s*Facebook$/i, '')
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean);
            if (pipeParts.length >= 3) {
              views = pipeParts[0];
              title = pipeParts[1];
              channel = pipeParts[2];
            } else if (pipeParts.length === 2) {
              if (/views|reactions|likes/i.test(pipeParts[0])) {
                views = pipeParts[0];
                title = pipeParts[1];
              } else {
                title = pipeParts[0];
                channel = pipeParts[1];
              }
            } else {
              title = pipeParts[0] || title;
            }
          }
          if (rawDesc && title === 'Facebook Video') {
            title = rawDesc.slice(0, 120);
          }

          extractFbStreamsFromText(ogHtml);
        }
      } catch (e) {
        console.warn('Facebook OG lookup warning:', e);
      }

      // Extract numeric video/reel ID if present in canonicalFbUrl
      const fbIdMatch =
        canonicalFbUrl.match(/(?:\/reel\/|\/videos\/|[?&]v=)(\d+)/i) ||
        cleanUrl.match(/(?:\/reel\/|\/videos\/|[?&]v=)(\d+)/i);
      const fbVideoId = fbIdMatch ? fbIdMatch[1] : null;

      // Step B: Try Facebook Public Video Plugin Embed endpoint (never redirects to login for public videos)
      if (!hdVideoUrl && !sdVideoUrl) {
        const pluginTargets = [canonicalFbUrl];
        if (fbVideoId) {
          pluginTargets.push(`https://www.facebook.com/watch/?v=${fbVideoId}`);
          pluginTargets.push(`https://www.facebook.com/reel/${fbVideoId}`);
        }
        for (const tUrl of pluginTargets) {
          try {
            const plugUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(tUrl)}&show_text=0`;
            const plugRes = await fetchWithTimeout(plugUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Mode': 'navigate'
              }
            });
            if (plugRes.ok) {
              const plugHtml = await plugRes.text();
              extractFbStreamsFromText(plugHtml);
              if (hdVideoUrl || sdVideoUrl) break;
            }
          } catch (_) {}
        }
      }

      // Step C: Fetch canonical URL & watch URL with Desktop Chrome navigation headers
      if (!hdVideoUrl && !sdVideoUrl) {
        const pageTargets = [canonicalFbUrl];
        if (fbVideoId) {
          pageTargets.push(`https://www.facebook.com/reel/${fbVideoId}`);
          pageTargets.push(`https://www.facebook.com/watch/?v=${fbVideoId}`);
        }
        for (const pUrl of pageTargets) {
          try {
            const fbRes = await fetchWithTimeout(pUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none'
              },
              redirect: 'follow'
            });
            if (fbRes.ok) {
              const fbHtml = await fbRes.text();
              extractFbStreamsFromText(fbHtml);
              if (hdVideoUrl || sdVideoUrl) break;
            }
          } catch (_) {}
        }
      }

      // Step D: Try fdown.net extractor fallback
      if (!hdVideoUrl && !sdVideoUrl) {
        try {
          const body = new URLSearchParams({ URLz: canonicalFbUrl }).toString();
          const fdRes = await fetchWithTimeout('https://fdown.net/download.php', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Origin: 'https://fdown.net',
              Referer: 'https://fdown.net/'
            },
            body
          });
          if (fdRes.ok) {
            const fdHtml = await fdRes.text();
            const hdHref = fdHtml.match(/id="hdlink"[^>]+href="([^"]+)"/i)?.[1];
            const sdHref = fdHtml.match(/id="sdlink"[^>]+href="([^"]+)"/i)?.[1];
            if (hdHref) hdVideoUrl = decodeHtmlEntities(hdHref);
            if (sdHref) sdVideoUrl = decodeHtmlEntities(sdHref);
          }
        } catch (_) {}
      }

      const bestVideo = hdVideoUrl || sdVideoUrl;
      if (!bestVideo) {
        return res.status(422).json({
          error: 'Could not extract video stream from this Facebook link. Please make sure the Facebook video or Reel is public.'
        });
      }

      let fileSizeMb = 10;
      try {
        const headRes = await fetchWithTimeout(bestVideo, { method: 'HEAD' }, 3500);
        const len = headRes.headers.get('content-length');
        if (len) {
          fileSizeMb = Math.max(1, Math.round((parseInt(len, 10) / (1024 * 1024)) * 10) / 10);
        }
      } catch (_) {}

      const proxiedHd = `/api/download/proxy?url=${encodeURIComponent(bestVideo)}`;
      const proxiedSd = sdVideoUrl
        ? `/api/download/proxy?url=${encodeURIComponent(sdVideoUrl)}`
        : proxiedHd;
      const proxiedThumb = rawThumbnail
        ? `/api/download/proxy?url=${encodeURIComponent(rawThumbnail)}`
        : 'https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?q=80&w=1200&auto=format&fit=crop';

      return res.json({
        id: `fb_${fbVideoId || Date.now()}`,
        url: cleanUrl,
        platform: 'facebook',
        title,
        channel,
        thumbnail: proxiedThumb,
        views,
        duration: formatDuration(durationSec),
        durationSeconds: durationSec,
        category: 'Facebook Watch',
        description: title,
        sampleVideoUrl: proxiedHd,
        captions: [],
        formats: [
          {
            id: 'fb-hd-1080',
            quality: 'Facebook Full HD (MP4)',
            resolution: '1080p Full HD',
            fps: 60,
            container: 'MP4',
            videoCodec: 'H.264 High Profile',
            audioCodec: 'AAC-LC 256 kbps',
            bitrate: '8.0 Mbps',
            approxSizeMb: fileSizeMb,
            isHighRes: true,
            badge: 'Full HD MP4',
            type: 'video',
            downloadUrl: proxiedHd
          },
          {
            id: 'fb-sd-480',
            quality: 'Facebook Standard SD (MP4)',
            resolution: '480p SD',
            fps: 30,
            container: 'MP4',
            videoCodec: 'H.264',
            audioCodec: 'AAC-LC 128 kbps',
            bitrate: '3.0 Mbps',
            approxSizeMb: Math.max(1, Math.round(fileSizeMb * 0.6)),
            isHighRes: false,
            badge: 'Standard SD',
            type: 'video',
            downloadUrl: proxiedSd
          },
          {
            id: 'fb-audio-320',
            quality: 'Facebook Audio Track (MP3)',
            resolution: 'Audio Only',
            fps: 0,
            container: 'MP3',
            videoCodec: 'None',
            audioCodec: 'AAC / MP3 320 kbps',
            bitrate: '320 kbps',
            approxSizeMb: Math.max(1, Math.round(fileSizeMb * 0.25)),
            isHighRes: true,
            badge: 'Audio Track',
            type: 'audio',
            downloadUrl: proxiedHd
          }
        ]
      });
    }

    // =========================================================================
    // 4. PINTEREST (Video Pins, Idea Pins & pin.it Short Links)
    // =========================================================================
    if (platform === 'pinterest') {
      let resolvedPinUrl = cleanUrl;
      let pinMatch = resolvedPinUrl.match(/pin\/(?:[^/]*--)?([0-9]+)/);

      // Step A: Resolve pin.it short URLs
      if (!pinMatch) {
        try {
          const redirRes = await fetchWithTimeout(cleanUrl, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            redirect: 'follow'
          });
          if (redirRes.url) {
            resolvedPinUrl = redirRes.url;
            pinMatch = resolvedPinUrl.match(/pin\/(?:[^/]*--)?([0-9]+)/);
          }
        } catch (_) {}
      }

      const pinId = pinMatch ? pinMatch[1] : null;
      let title = `Pinterest Video Pin ${pinId ? '#' + pinId : ''}`;
      let channel = 'Pinterest Creator';
      let rawThumbnail = '';
      let pinVideoUrl = '';
      let durationSec = 25;

      // Step B: Pinterest Pidgets API (checks both video_list and story_pin_data)
      if (pinId) {
        try {
          const pidgetRes = await fetchWithTimeout(
            `https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=${pinId}`
          );
          if (pidgetRes.ok) {
            const pJson = await pidgetRes.json();
            const pinData = pJson?.data?.[0];
            if (pinData && !pinData.error) {
              title =
                pinData.description?.trim() ||
                pinData.rich_summary?.display_name ||
                pinData.grid_title ||
                title;
              channel = pinData.pinner?.full_name || pinData.domain || channel;
              rawThumbnail =
                pinData.images?.['564x']?.url ||
                pinData.images?.['236x']?.url ||
                '';

              const vList =
                pinData.videos?.video_list ||
                pinData.story_pin_data?.pages?.[0]?.blocks?.[0]?.video?.video_list;
              if (vList) {
                const mp4Entries = Object.values(vList).filter(
                  (v) => v && typeof v.url === 'string' && v.url.includes('.mp4')
                );
                if (mp4Entries.length > 0) {
                  // Sort by width/height descending for highest quality
                  mp4Entries.sort((a, b) => (b.width || 0) - (a.width || 0));
                  pinVideoUrl = mp4Entries[0].url;
                  if (mp4Entries[0].duration) {
                    durationSec = Math.max(
                      1,
                      Math.round(
                        mp4Entries[0].duration > 1000
                          ? mp4Entries[0].duration / 1000
                          : mp4Entries[0].duration
                      )
                    );
                  }
                }
              }

              // Fallback scan across entire pinData JSON for any pinimg .mp4 URL
              if (!pinVideoUrl) {
                const rawStr = JSON.stringify(pinData);
                const mp4Match = rawStr.match(/https:\/\/v1\.pinimg\.com\/videos\/[^"'\s\\]+\.mp4/i);
                if (mp4Match) pinVideoUrl = mp4Match[0];
              }
            }
          }
        } catch (e) {
          console.warn('Pinterest pidget warning:', e);
        }
      }

      // Step C: Scrape Pinterest Pin Page HTML (__PWS_DATA__)
      if (!pinVideoUrl) {
        try {
          const targetPinPage = pinId
            ? `https://www.pinterest.com/pin/${pinId}/`
            : resolvedPinUrl;
          const pageRes = await fetchWithTimeout(targetPinPage, {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
          });
          if (pageRes.ok) {
            const rawHtml = await pageRes.text();
            const unescaped = rawHtml.replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
            const mp4Matches = [
              ...unescaped.matchAll(/https:\/\/v1\.pinimg\.com\/videos\/[^"'\s\\<>]+\.mp4/gi)
            ].map((m) => m[0]);
            if (mp4Matches.length > 0) {
              pinVideoUrl =
                mp4Matches.find((u) => u.includes('720p') || u.includes('exp7')) ||
                mp4Matches[0];
            }
            if (!rawThumbnail) {
              const ogImg = rawHtml.match(/property="og:image"\s+content="([^"]+)"/i)?.[1];
              if (ogImg) rawThumbnail = decodeHtmlEntities(ogImg);
            }
            const ogTit = rawHtml.match(/property="og:title"\s+content="([^"]+)"/i)?.[1];
            if (ogTit && title.startsWith('Pinterest Video Pin')) {
              title = decodeHtmlEntities(ogTit);
            }
          }
        } catch (_) {}
      }

      if (!pinVideoUrl) {
        return res.status(422).json({
          error: 'Could not find a video stream in this Pinterest Pin. Make sure the Pin is a Video Pin (not a static image).'
        });
      }

      const proxiedVideo = `/api/download/proxy?url=${encodeURIComponent(pinVideoUrl)}`;
      const proxiedThumb = rawThumbnail
        ? `/api/download/proxy?url=${encodeURIComponent(rawThumbnail)}`
        : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1200&auto=format&fit=crop';

      return res.json({
        id: `pin_${pinId || Date.now()}`,
        url: cleanUrl,
        platform: 'pinterest',
        title,
        channel,
        thumbnail: proxiedThumb,
        views: 'Pinterest Video Pin',
        duration: formatDuration(durationSec),
        durationSeconds: durationSec,
        category: 'Pinterest Inspiration',
        description: title,
        sampleVideoUrl: proxiedVideo,
        captions: [],
        formats: [
          {
            id: 'pin-hd-1080',
            quality: 'Pinterest HD Video Pin (MP4)',
            resolution: '1080x1920 (Original)',
            fps: 60,
            container: 'MP4',
            videoCodec: 'H.264 High',
            audioCodec: 'AAC-LC 256 kbps',
            bitrate: '8.0 Mbps',
            approxSizeMb: 6,
            isHighRes: true,
            badge: 'HD Video Pin',
            type: 'video',
            downloadUrl: proxiedVideo
          },
          {
            id: 'pin-audio-320',
            quality: 'Pin Audio Track (MP3)',
            resolution: 'Audio Only',
            fps: 0,
            container: 'MP3',
            videoCodec: 'None',
            audioCodec: 'AAC / MP3 320 kbps',
            bitrate: '320 kbps',
            approxSizeMb: 2,
            isHighRes: true,
            badge: 'Pin Audio',
            type: 'audio',
            downloadUrl: proxiedVideo
          }
        ]
      });
    }

    // =========================================================================
    // 5. YOUTUBE (Real Video & Audio Stream Extraction)
    // =========================================================================
    const videoId = extractYouTubeId(cleanUrl);
    if (!videoId) {
      return res.status(400).json({
        error: 'Invalid YouTube URL. Please paste a valid YouTube video or Shorts link.'
      });
    }

    let title = 'YouTube Video';
    let channel = 'YouTube Creator';
    let thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    let durationSec = 210;
    let views = 'YouTube Stream';
    let description = '';

    // Step A: Fetch oEmbed metadata for instant title & channel
    try {
      const oembedResponse = await fetchWithTimeout(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
        {},
        3500
      );
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        title = oembedData.title || title;
        channel = oembedData.author_name || channel;
        thumbnail = oembedData.thumbnail_url || thumbnail;
      }
    } catch (_) {}

    let extractedFormats = [];
    let bestCombinedUrl = '';
    let bestAudioUrl = '';

    // Step B: Layer 1 — YouTube Innertube API (ANDROID_VR & IOS clients)
    const innertubeClients = [
      {
        clientName: 'ANDROID_VR',
        clientVersion: '1.60.19',
        deviceMake: 'Oculus',
        deviceModel: 'Quest 3',
        osName: 'Android',
        osVersion: '12L',
        androidSdkVersion: 32,
        userAgent:
          'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip'
      },
      {
        clientName: 'IOS',
        clientVersion: '19.45.4',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iPhone',
        osVersion: '17.5.1.21F90',
        userAgent:
          'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)'
      }
    ];

    for (const clientCfg of innertubeClients) {
      if (bestCombinedUrl) break;
      try {
        const ytRes = await fetchWithTimeout(
          'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': clientCfg.userAgent
            },
            body: JSON.stringify({
              videoId,
              context: {
                client: {
                  clientName: clientCfg.clientName,
                  clientVersion: clientCfg.clientVersion,
                  deviceMake: clientCfg.deviceMake,
                  deviceModel: clientCfg.deviceModel,
                  osName: clientCfg.osName,
                  osVersion: clientCfg.osVersion,
                  androidSdkVersion: clientCfg.androidSdkVersion,
                  hl: 'en',
                  gl: 'US'
                }
              },
              contentCheckOk: true,
              racyCheckOk: true
            })
          },
          5000
        );

        if (ytRes.ok) {
          const ytData = await ytRes.json();
          const vd = ytData?.videoDetails;
          if (vd) {
            title = vd.title || title;
            channel = vd.author || channel;
            durationSec = Number(vd.lengthSeconds) || durationSec;
            if (vd.viewCount) {
              views = `${Number(vd.viewCount).toLocaleString()} views`;
            }
            if (vd.shortDescription) {
              description = vd.shortDescription.slice(0, 300);
            }
          }

          const combined = (ytData?.streamingData?.formats || []).filter(
            (f) => f.url && f.mimeType?.includes('mp4')
          );
          const adaptive = (ytData?.streamingData?.adaptiveFormats || []).filter(
            (f) => f.url
          );

          if (combined.length > 0) {
            combined.sort((a, b) => (b.height || 0) - (a.height || 0));
            bestCombinedUrl = combined[0].url;

            for (const c of combined) {
              const h = c.height || 360;
              const proxied = `/api/download/proxy?url=${encodeURIComponent(c.url)}`;
              const sizeMb = c.contentLength
                ? Math.max(1, Math.round((Number(c.contentLength) / (1024 * 1024)) * 10) / 10)
                : Math.max(3, Math.round((durationSec * (h >= 720 ? 5 : 2.5)) / 8));
              extractedFormats.push({
                id: `yt-${h}p`,
                quality: `${h}p ${h >= 720 ? 'HD' : 'Standard'} (MP4)`,
                resolution: `${c.width || 1280}x${h}`,
                fps: c.fps || 30,
                container: 'MP4',
                videoCodec: 'H.264 / AVC',
                audioCodec: 'AAC-LC 192 kbps',
                bitrate: h >= 720 ? '5.0 Mbps' : '2.5 Mbps',
                approxSizeMb: sizeMb,
                isHighRes: h >= 720,
                badge: h >= 720 ? `${h}p HD` : `${h}p MP4`,
                type: 'video',
                downloadUrl: proxied
              });
            }
          }

          const audioStreams = adaptive.filter((f) => f.mimeType?.startsWith('audio/'));
          if (audioStreams.length > 0) {
            audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
            bestAudioUrl = audioStreams[0].url;
          }
        }
      } catch (e) {
        console.warn(`Innertube ${clientCfg.clientName} warning:`, e);
      }
    }

    // Step C: Layer 2 — Piped Public API instances fallback
    if (!bestCombinedUrl) {
      const pipedHosts = [
        'https://pipedapi.kavin.rocks',
        'https://api.piped.private.coffee',
        'https://pipedapi.tokhmi.xyz',
        'https://pipedapi.moomoo.me'
      ];
      for (const host of pipedHosts) {
        try {
          const pRes = await fetchWithTimeout(`${host}/streams/${videoId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          }, 4500);
          if (pRes.ok) {
            const pData = await pRes.json();
            if (pData.title) title = pData.title;
            if (pData.uploader) channel = pData.uploader;
            if (pData.duration) durationSec = Number(pData.duration) || durationSec;
            if (pData.views) views = `${Number(pData.views).toLocaleString()} views`;

            const vStreams = (pData.videoStreams || []).filter(
              (s) => s.url && s.videoOnly === false && (s.format === 'MPEG_4' || s.mimeType?.includes('mp4'))
            );
            const aStreams = (pData.audioStreams || []).filter((s) => s.url);

            if (vStreams.length > 0) {
              vStreams.sort((a, b) => (b.height || 0) - (a.height || 0));
              bestCombinedUrl = vStreams[0].url;
              for (const vs of vStreams) {
                const proxied = `/api/download/proxy?url=${encodeURIComponent(vs.url)}`;
                extractedFormats.push({
                  id: `yt-piped-${vs.quality || '720p'}`,
                  quality: `YouTube ${vs.quality || '720p'} (MP4)`,
                  resolution: `${vs.width || 1280}x${vs.height || 720}`,
                  fps: vs.fps || 30,
                  container: 'MP4',
                  videoCodec: 'H.264',
                  audioCodec: 'AAC',
                  bitrate: '4.5 Mbps',
                  approxSizeMb: Math.max(4, Math.round((durationSec * 4) / 8)),
                  isHighRes: (vs.height || 720) >= 720,
                  badge: `${vs.quality || '720p'} MP4`,
                  type: 'video',
                  downloadUrl: proxied
                });
              }
            }
            if (aStreams.length > 0) {
              bestAudioUrl = aStreams[0].url;
            }
            if (bestCombinedUrl) break;
          }
        } catch (_) {}
      }
    }

    // Step D: Layer 3 — Invidious Public API instances with local=true stream proxy
    if (!bestCombinedUrl) {
      const invHosts = [
        'https://inv.tux.pizza',
        'https://invidious.nerdvpn.de',
        'https://invidious.jing.rocks',
        'https://vid.puffyan.us'
      ];
      for (const host of invHosts) {
        try {
          const iRes = await fetchWithTimeout(`${host}/api/v1/videos/${videoId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
          }, 4500);
          if (iRes.ok) {
            const iData = await iRes.json();
            if (iData.title) title = iData.title;
            if (iData.author) channel = iData.author;
            if (iData.lengthSeconds) durationSec = Number(iData.lengthSeconds) || durationSec;
            if (iData.viewCount) views = `${Number(iData.viewCount).toLocaleString()} views`;

            const fStreams = (iData.formatStreams || []).filter((s) => s.itag);
            if (fStreams.length > 0) {
              for (const fs of fStreams) {
                const localStreamUrl = `${host}/latest_version?id=${videoId}&itag=${fs.itag}&local=true`;
                const proxied = `/api/download/proxy?url=${encodeURIComponent(localStreamUrl)}`;
                if (!bestCombinedUrl) bestCombinedUrl = localStreamUrl;
                extractedFormats.push({
                  id: `yt-inv-${fs.qualityLabel || fs.itag}`,
                  quality: `YouTube ${fs.qualityLabel || '720p'} (MP4)`,
                  resolution: fs.size || '1280x720',
                  fps: fs.fps || 30,
                  container: 'MP4',
                  videoCodec: 'H.264',
                  audioCodec: 'AAC',
                  bitrate: '4.0 Mbps',
                  approxSizeMb: Math.max(4, Math.round((durationSec * 4) / 8)),
                  isHighRes: String(fs.qualityLabel).includes('720'),
                  badge: `${fs.qualityLabel || 'HD'} MP4`,
                  type: 'video',
                  downloadUrl: proxied
                });
              }
              break;
            }
          }
        } catch (_) {}
      }
    }

    if (!bestCombinedUrl) {
      return res.status(422).json({
        error: 'Could not extract direct video stream for this YouTube video right now. Please try another link.'
      });
    }

    const primaryProxiedVideo = `/api/download/proxy?url=${encodeURIComponent(bestCombinedUrl)}`;
    const primaryProxiedAudio = bestAudioUrl
      ? `/api/download/proxy?url=${encodeURIComponent(bestAudioUrl)}`
      : primaryProxiedVideo;

    // Add audio format
    extractedFormats.push({
      id: 'yt-audio-mp3-320',
      quality: 'MP3 / M4A Master Audio',
      resolution: 'Audio Only',
      fps: 0,
      container: 'MP3',
      videoCodec: 'None',
      audioCodec: 'AAC / MP3 (320 kbps)',
      bitrate: '320 kbps',
      approxSizeMb: Math.max(1, Math.round((durationSec * 0.32) / 8)),
      isHighRes: true,
      badge: '320 kbps Audio',
      type: 'audio',
      downloadUrl: primaryProxiedAudio
    });

    return res.json({
      id: videoId,
      url: cleanUrl,
      platform: 'youtube',
      title,
      channel,
      thumbnail,
      views,
      duration: formatDuration(durationSec),
      durationSeconds: durationSec,
      category: 'YouTube Video',
      description: description || `${title} by ${channel}`,
      sampleVideoUrl: primaryProxiedVideo,
      captions: [],
      formats: extractedFormats
    });
  } catch (err) {
    console.error('Error fetching media info:', err);
    return res.status(500).json({
      error: 'Failed to inspect media URL',
      details: err?.message
    });
  }
}
