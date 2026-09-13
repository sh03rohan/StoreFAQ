import type { APIRoute } from 'astro';

export const prerender = false;

const json = (status: number, message: string) =>
  new Response(JSON.stringify({ message }), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * "Was this helpful?" → BetterDocs' feedback endpoint on the CMS. Whether that
 * data is worth keeping is still an open question (NOTES §B5); until it is
 * answered and the CMS exists, this says so rather than swallowing the click.
 */
export const POST: APIRoute = async ({ request }) => {
  let body: { doc?: string; reaction?: string };
  try { body = await request.json(); } catch { return json(400, 'Invalid request.'); }
  if (!body.doc || !['happy', 'normal', 'sad'].includes(body.reaction ?? '')) return json(400, 'Invalid request.');

  const base = import.meta.env.CMS_URL;
  if (!base) return json(503, 'Feedback is temporarily unavailable.');

  try {
    const res = await fetch(`${base}/wp-json/betterdocs/v1/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: body.doc, feedback: body.reaction }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? json(200, 'Thanks for the feedback') : json(502, 'Something went wrong. Please try again.');
  } catch { return json(502, 'Something went wrong. Please try again.'); }
};
