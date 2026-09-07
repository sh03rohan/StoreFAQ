import type { APIRoute } from 'astro';

export const prerender = false;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Newsletter subscribe → FluentCRM on the CMS (A1 decision: keep the
 * existing list rather than migrating to Mailchimp/Brevo).
 *
 * Credentials are an application password for a dedicated WP user with
 * only the FluentCRM capability. They never reach the browser.
 */
export const POST: APIRoute = async ({ request }) => {
  let email = '';
  try {
    const body = await request.json();
    email = String(body?.email ?? '').trim().toLowerCase();
  } catch {
    return json(400, 'Invalid request.');
  }

  if (!EMAIL.test(email) || email.length > 254) {
    return json(400, 'Please enter a valid email address.');
  }

  const base = import.meta.env.FLUENTCRM_URL;
  const user = import.meta.env.FLUENTCRM_USER;
  const pass = import.meta.env.FLUENTCRM_APP_PASSWORD;
  const listId = import.meta.env.FLUENTCRM_LIST_ID;
  const tagId = import.meta.env.FLUENTCRM_TAG_ID;

  if (!base || !user || !pass) {
    console.error('[subscribe] FluentCRM env vars are not configured');
    return json(500, 'Subscriptions are temporarily unavailable.');
  }

  const payload: Record<string, unknown> = {
    email,
    status: 'pending',            // double opt-in; FluentCRM sends the confirmation
    ...(listId ? { lists: [Number(listId)] } : {}),
    ...(tagId ? { tags: [Number(tagId)] } : {}),
  };

  try {
    const res = await fetch(`${base}/subscribers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64'),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      return json(200, 'Thanks — please check your inbox to confirm.');
    }

    // An already-subscribed address is not an error worth showing as one.
    const text = await res.text();
    if (res.status === 422 && /exist/i.test(text)) {
      return json(200, "You're already subscribed.");
    }

    console.error('[subscribe] FluentCRM responded', res.status, text.slice(0, 300));
    return json(502, 'Something went wrong. Please try again.');
  } catch (err) {
    console.error('[subscribe] request failed', err);
    return json(502, 'Something went wrong. Please try again.');
  }
};
