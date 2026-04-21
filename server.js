const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const PUBLICATION_ID = 'pub_0fbe3cc7-9a18-4233-92cb-36f5e9dc0d30';
const SPARKLOOP_API_BASE = 'https://js.sparkloop.app';
const SPARKLOOP_SETTINGS_BASE = 'https://script-settings.sparkloop.app';
const SPARKLOOP_SCRIPT_URL = 'https://script.sparkloop.app/embed.js';

app.use(express.json());

app.get('/sparkloop/embed.js', async (req, res) => {
  try {
    const publicationId = req.query.publication_id;
    const upstreamUrl = new URL(SPARKLOOP_SCRIPT_URL);

    if (publicationId) {
      upstreamUrl.searchParams.set('publication_id', publicationId);
    }

    const response = await fetch(upstreamUrl);
    const script = await response.text();

    res.type('application/javascript').send(script);
  } catch (err) {
    console.error('SparkLoop script proxy error:', err);
    res.status(502).send('SparkLoop script unavailable');
  }
});

app.all('/sparkloop/:publicationId/*', async (req, res) => {
  try {
    const upstreamPath = req.params[0];
    const upstreamBase = upstreamPath === 'settings'
      ? SPARKLOOP_SETTINGS_BASE
      : SPARKLOOP_API_BASE;
    const upstreamUrl = new URL(
      `/${req.params.publicationId}/${upstreamPath}`,
      upstreamBase
    );

    for (const [key, value] of Object.entries(req.query)) {
      upstreamUrl.searchParams.set(key, value);
    }

    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': req.get('Content-Type') || 'application/json',
      },
    };

    if (!['GET', 'HEAD'].includes(req.method)) {
      fetchOptions.body = JSON.stringify(req.body || {});
    }

    const response = await fetch(upstreamUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || 'application/json';
    let body = await response.text();

    if (upstreamPath === 'settings' && contentType.includes('application/json')) {
      const settings = JSON.parse(body);
      const protocol = req.get('x-forwarded-proto') || req.protocol;
      const origin = `${protocol}://${req.get('host')}`;

      settings.script_url = `${origin}/sparkloop`;

      if (settings.widgets && Array.isArray(settings.widgets.upscribes)) {
        settings.widgets.upscribes = settings.widgets.upscribes.map((upscribe) => ({
          ...upscribe,
          after_submission: {
            ...upscribe.after_submission,
            default_redirect_url: `${origin}/thank-you/`,
          },
        }));
      }

      body = JSON.stringify(settings);
    }

    res.status(response.status).type(contentType).send(body);
  } catch (err) {
    console.error('SparkLoop API proxy error:', err);
    res.status(502).json({ error: 'SparkLoop API unavailable' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    const response = await fetch(
      `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          send_welcome_email: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Beehiiv error:', data);
      return res.status(response.status).json({ error: 'Subscription failed' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
