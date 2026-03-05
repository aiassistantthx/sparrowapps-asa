const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;

const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
const PUBLICATION_ID = 'pub_0fbe3cc7-9a18-4233-92cb-36f5e9dc0d30';

app.use(express.json());
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
