import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_NOTIFY_EMAIL =
  process.env.ADMIN_NOTIFY_EMAIL || 'hminhthom203@gmail.com';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.post('/api/notify-admin', async (req, res) => {
    const body = req.body as {
      type?: string;
      characterName?: string;
      actorName?: string;
      message?: string;
    };

    const type = body?.type === 'comment' ? 'comment' : 'like';
    const characterName = String(body?.characterName || '').slice(0, 80).trim();
    const actorName = String(body?.actorName || '').slice(0, 80).trim();
    const message = String(body?.message || '').slice(0, 600).trim();

    if (!characterName || !actorName || !message) {
      res.status(400).json({ emailed: false, status: 'invalid_payload' });
      return;
    }

    const smtpUser = process.env.SMTP_USER || '';
    const smtpPass = process.env.SMTP_PASS || '';

    if (!smtpUser || !smtpPass) {
      res.json({ emailed: false, status: 'not_configured' });
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const subject =
        type === 'like'
          ? `[Ăn Kẹo Hong] ${actorName} đã thả tim cho ${characterName}`
          : `[Ăn Kẹo Hong] ${actorName} đã bình luận về ${characterName}`;

      await transporter.sendMail({
        from: `"Ăn Kẹo Hong" <${smtpUser}>`,
        to: ADMIN_NOTIFY_EMAIL,
        subject,
        text: `${subject}\n\nNội dung: ${message}\n\nXem tại: ${process.env.APP_URL || ''}`,
      });

      res.json({ emailed: true, status: 'sent' });
    } catch (err) {
      console.error('Failed to send admin Gmail notification:', err);
      res.status(500).json({ emailed: false, status: 'queued' });
    }
  });

  app.get('/api/drive-media', async (req, res) => {
    const id = String(req.query.id || '').trim();
    const kind = req.query.kind === 'image' ? 'image' : 'audio';

    if (!/^[a-zA-Z0-9_-]{10,120}$/.test(id)) {
      res.status(400).json({ error: 'Invalid Google Drive file ID' });
      return;
    }

    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0',
    };
    if (typeof req.headers.range === 'string' && req.headers.range.trim()) {
      forwardHeaders.Range = req.headers.range;
    }

    const fetchDriveUrl = async (targetUrl: string) =>
      fetch(targetUrl, {
        headers: forwardHeaders,
        redirect: 'follow',
      });

    try {
      let upstream = await fetchDriveUrl(
        `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`
      );
      let contentType = upstream.headers.get('content-type') || '';

      if (contentType.includes('text/html')) {
        const html = await upstream.text();
        const confirmMatch = html.match(/name="confirm"\s+value="([^"]+)"/i) ||
          html.match(/[?&]confirm=([a-zA-Z0-9_-]+)/i);
        const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i);

        if (confirmMatch) {
          const confirmUrl = new URL('https://drive.usercontent.google.com/download');
          confirmUrl.searchParams.set('id', id);
          confirmUrl.searchParams.set('export', 'download');
          confirmUrl.searchParams.set('confirm', confirmMatch[1]);
          if (uuidMatch) {
            confirmUrl.searchParams.set('uuid', uuidMatch[1]);
          }
          upstream = await fetchDriveUrl(confirmUrl.toString());
          contentType = upstream.headers.get('content-type') || '';
        }

        if ((contentType.includes('text/html') || !upstream.ok) && kind === 'image') {
          upstream = await fetchDriveUrl(
            `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`
          );
          contentType = upstream.headers.get('content-type') || '';
        }
      }

      if (!upstream.ok || contentType.includes('text/html') || !upstream.body) {
        res.status(404).json({
          error:
            'Không thể tải tệp từ Google Drive. Hãy đảm bảo tệp được bật chia sẻ công khai (Bất kỳ ai có đường liên kết).',
        });
        return;
      }

      res.status(upstream.status);
      if (contentType) res.setHeader('Content-Type', contentType);
      const contentLength = upstream.headers.get('content-length');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      const contentRange = upstream.headers.get('content-range');
      if (contentRange) res.setHeader('Content-Range', contentRange);
      res.setHeader(
        'Accept-Ranges',
        upstream.headers.get('accept-ranges') || 'bytes'
      );
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const { Readable } = await import('stream');
      Readable.fromWeb(upstream.body as unknown as import('stream/web').ReadableStream).pipe(res);
    } catch (err) {
      console.error('Drive media proxy error:', err);
      res.status(502).json({ error: 'Không thể kết nối tới Google Drive.' });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
