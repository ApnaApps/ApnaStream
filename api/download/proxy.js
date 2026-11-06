export default async function handleDownloadProxy(req, res) {
  try {
    const mediaUrl = req.query?.url;
    const filename = req.query?.filename || 'apnastream_media.mp4';

    if (!mediaUrl || typeof mediaUrl !== 'string') {
      return res.status(400).send('Missing media url parameter');
    }

    const lowerUrl = mediaUrl.toLowerCase();
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: '*/*'
    };

    if (lowerUrl.includes('googlevideo.com')) {
      if (lowerUrl.includes('c=android_vr')) {
        headers['User-Agent'] =
          'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';
      } else if (lowerUrl.includes('c=ios')) {
        headers['User-Agent'] =
          'com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)';
      }
    } else if (lowerUrl.includes('cdninstagram.com')) {
      headers['Referer'] = 'https://www.instagram.com/';
    } else if (lowerUrl.includes('tiktok') || lowerUrl.includes('tikwm')) {
      headers['Referer'] = 'https://www.tiktok.com/';
    } else if (lowerUrl.includes('pinimg.com')) {
      headers['Referer'] = 'https://www.pinterest.com/';
    } else if (lowerUrl.includes('fbcdn.net')) {
      headers['Referer'] = 'https://www.facebook.com/';
    }

    if (req.headers?.range) {
      headers['Range'] = req.headers.range;
    }

    const upstreamRes = await fetch(mediaUrl, {
      headers,
      redirect: 'follow'
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      return res
        .status(upstreamRes.status)
        .send(`Failed to fetch media stream from source (${upstreamRes.status})`);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    const contentType = upstreamRes.headers.get('content-type') || 'video/mp4';
    res.setHeader('Content-Type', contentType);

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
      res.status(206);
    }

    if (req.query?.download === '1') {
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(filename)}"`
      );
    }

    if (upstreamRes.body) {
      const reader = upstreamRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } else {
      const arrayBuf = await upstreamRes.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    }
  } catch (err) {
    console.error('Download proxy error:', err);
    if (!res.headersSent) {
      res.status(500).send('Streaming proxy error');
    } else {
      res.end();
    }
  }
}
