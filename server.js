'use strict';

// Shoora AI - GapGPT Server
// Node.js 20+
// Deploy on Render

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);

const MODEL = process.env.GAPGPT_MODEL || 'gpt-4o-mini';

const API_URL =
  process.env.GAPGPT_API_URL ||
  'https://api.gapgpt.app/v1/chat/completions';

const INDEX_PATH = path.join(__dirname, 'index.html');

const MAX_BODY = 60000;

const requests = new Map();

function json(res, code, value) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });

  res.end(JSON.stringify(value));
}

async function bodyAsJson(req) {
  let size = 0;
  const chunks = [];

  for await (const chunk of req) {
    size += chunk.length;

    if (size > MAX_BODY) {
      const err = new Error('حجم درخواست بیش از حد مجاز است.');
      err.status = 413;
      throw err;
    }

    chunks.push(chunk);
  }

  try {
    return JSON.parse(
      Buffer.concat(chunks).toString('utf8')
    );
  } catch (_) {
    const err = new Error('درخواست JSON معتبر نیست.');
    err.status = 400;
    throw err;
  }
}

function extractJson(content) {
  if (typeof content !== 'string') {
    throw new Error('پاسخ متنی از سرویس دریافت نشد.');
  }

  let source = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  const first = source.indexOf('{');
  const last = source.lastIndexOf('}');

  if (first >= 0 && last > first) {
    source = source.slice(first, last + 1);
  }

  try {
    return JSON.parse(source);
  } catch (_) {
    throw new Error(
      'هوش مصنوعی JSON معتبر برنگرداند. دوباره تلاش کنید.'
    );
  }
}

function rateLimit(req) {
  const ip = req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  const history = (requests.get(ip) || [])
    .filter(t => now - t < 600000);

  if (history.length >= 12) {
    requests.set(ip, history);
    return false;
  }

  history.push(now);
  requests.set(ip, history);

  if (requests.size > 10000) {
    for (const [k, timestamps] of requests) {
      if (!timestamps.some(t => now - t < 600000)) {
        requests.delete(k);
      }
    }
  }

  return true;
}

const server = http.createServer(async (req, res) => {
  const pathname = (req.url || '/').split('?')[0];

  // Serve HTML website
  if (
    req.method === 'GET' &&
    (pathname === '/' || pathname === '/index.html')
  ) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff'
    });

    fs.createReadStream(INDEX_PATH).pipe(res);
    return;
  }

  // Server health check
  if (
    req.method === 'GET' &&
    pathname === '/health'
  ) {
    json(res, 200, { ok: true });
    return;
  }

  // AI generation endpoint
  if (
    req.method !== 'POST' ||
    pathname !== '/api/generate'
  ) {
    json(res, 404, {
      error: 'مسیر پیدا نشد.'
    });

    return;
  }

  // Check API key
  if (!process.env.GAPGPT_API_KEY) {
    json(res, 503, {
      error:
        'کلید GAPGPT_API_KEY در Environment سرویس Render تنظیم نشده است.'
    });

    return;
  }

  // Rate limiting
  if (!rateLimit(req)) {
    json(res, 429, {
      error:
        'تعداد درخواست‌ها زیاد شده. چند دقیقه دیگر امتحان کنید.'
    });

    return;
  }

  let input;

  try {
    input = await bodyAsJson(req);
  } catch (err) {
    json(res, err.status || 400, {
      error: err.message
    });

    return;
  }

  const prompt = input && input.prompt;

  if (
    typeof prompt !== 'string' ||
    !prompt.trim() ||
    prompt.length > 24000
  ) {
    json(res, 400, {
      error:
        'متن درخواست نامعتبر یا بیش از حد بلند است.'
    });

    return;
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    115000
  );

  try {
    // Connect to GapGPT API
    const upstream = await fetch(API_URL, {
      method: 'POST',

      signal: controller.signal,

      headers: {
        'Content-Type': 'application/json',

        Authorization:
          `Bearer ${process.env.GAPGPT_API_KEY}`
      },

      body: JSON.stringify({
        model: MODEL,

        messages: [
          {
            role: 'system',

            content:
              'تو کارگردان دقیق شورای مشاوران کسب‌وکار هستی. ' +
              'فقط و فقط یک شیء JSON معتبر و کامل مطابق ساختار درخواستی تولید کن؛ ' +
              'بدون کدبلاک، بدون متن اضافه و به زبان فارسی. ' +
              'تمام مشاورهای انتخاب‌شده باید در بخش موضع و رأی حضور داشته باشند.'
          },

          {
            role: 'user',
            content: prompt
          }
        ],

        temperature: 0.7,

        max_tokens: 6500,

        stream: false
      })
    });

    const payloadText = await upstream.text();

    let payload;

    try {
      payload = JSON.parse(payloadText);
    } catch (_) {
      payload = null;
    }

    // Handle GapGPT errors
    if (!upstream.ok) {
      console.error(
        'GapGPT error:',
        upstream.status,
        payloadText.slice(0, 400)
      );

      const details = payload && payload.error;

      const message =
        typeof details === 'string'
          ? details
          : details?.message;

      json(
        res,
        upstream.status === 429 ? 429 : 502,
        {
          error:
            upstream.status === 401 ||
            upstream.status === 403

              ? 'کلید API گپ‌جی‌پی‌تی معتبر نیست یا دسترسی لازم را ندارد.'

              : upstream.status === 429

              ? 'سهمیه یا محدودیت درخواست گپ‌جی‌پی‌تی تمام شده است.'

              : (
                  'گپ‌جی‌پی‌تی پاسخ خطا داد' +
                  (
                    message
                      ? ': ' + String(message).slice(0, 240)
                      : '.'
                  )
                )
        }
      );

      return;
    }

    // Read AI response
    let content =
      payload?.choices?.[0]?.message?.content;

    if (Array.isArray(content)) {
      content = content
        .map(x => x?.text || '')
        .join('');
    }

    // Convert response to council session
    const session = extractJson(content);

    // Send session to HTML
    json(res, 200, session);

  } catch (err) {
    console.error(
      'Generate failed:',
      err.message
    );

    json(
      res,
      err.name === 'AbortError' ? 504 : 502,
      {
        error:
          err.name === 'AbortError'

            ? 'زمان پاسخ‌گویی گپ‌جی‌پی‌تی تمام شد. دوباره تلاش کنید.'

            : err.message
      }
    );

  } finally {
    clearTimeout(timeout);
  }
});

// Start server
server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `Shoora server on ${PORT} · model ${MODEL}`
    );
  }
);
