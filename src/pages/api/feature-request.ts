import type { APIRoute } from 'astro';

export const prerender = false;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LIMITS = { name: 100, email: 254, subject: 200, message: 5000 };

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Feature request → the CMS.
 *
 * The original stores these as Essential Blocks form entries in WordPress, so
 * this forwards to the same place. It cannot do that until the headless
 * WordPress endpoint exists (Phase 6); until then it says so plainly rather
 * than accepting a submission it will silently drop.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: Record<string, unknown>;
  try {
    body = request.headers.get('content-type')?.includes('application/json')
      ? await request.json()
      : Object.fromEntries(await request.formData());
  } catch {
    return json(400, 'Invalid request.');
  }

  const field = (k: keyof typeof LIMITS) => String(body?.[k] ?? '').trim();
  const name = field('name'), email = field('email');
  const subject = field('subject'), message = field('message');

  if (!name || !subject) return json(400, 'Please fill in every required field.');
  if (!EMAIL.test(email)) return json(400, 'Please enter a valid email address.');
  for (const [k, max] of Object.entries(LIMITS)) {
    if (field(k as keyof typeof LIMITS).length > max) return json(400, `That ${k} is too long.`);
  }

  const base = import.meta.env.CMS_URL;
  const user = import.meta.env.CMS_USER;
  const pass = import.meta.env.CMS_APP_PASSWORD;

  if (!base || !user || !pass) {
    console.error('[feature-request] CMS env vars are not configured');
    return json(503, 'Feature requests are temporarily unavailable — please email support instead.');
  }

  try {
    const res = await fetch(`${base}/wp-json/storefaq/v1/feature-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64'),
      },
      body: JSON.stringify({ name, email, subject, message }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) return json(200, 'Your form has been submitted Successfully!');

    console.error('[feature-request] CMS responded', res.status, (await res.text()).slice(0, 300));
    return json(502, "Your form couldn't been submitted! Please try again");
  } catch (err) {
    console.error('[feature-request] request failed', err);
    return json(502, "Your form couldn't been submitted! Please try again");
  }
};
