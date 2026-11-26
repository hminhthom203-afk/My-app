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
