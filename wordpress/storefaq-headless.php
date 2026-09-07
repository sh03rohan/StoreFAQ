<?php
/**
 * Plugin Name: StoreFAQ Headless Support
 * Description: Exposes resolved SEO metadata and BetterLinks redirects to the Astro frontend, and purges Vercel's cache on publish.
 * Version:     1.0.0
 *
 * Install as a must-use plugin:
 *   wp-content/mu-plugins/storefaq-headless.php
 *
 * Why this exists
 * ---------------
 * storefaq.io uses ThinkRank for SEO, which renders <title>, description,
 * robots, og:* and twitter:* from templates at request time. None of it is
 * exposed over the REST API, and the per-post override fields in post meta
 * are empty. Without this file every migrated post loses its title and
 * description. See NOTES.md, "BLOCKER — SEO meta is NOT exposed over REST".
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const STOREFAQ_FRONTEND = 'https://storefaq.io';

/* -------------------------------------------------------------------------
 * 1. Resolved SEO metadata as a single REST field.
 * ---------------------------------------------------------------------- */

add_action('rest_api_init', static function (): void {
    foreach (['post', 'page', 'docs'] as $type) {
        register_rest_field($type, 'seo', [
            'get_callback' => 'storefaq_rest_seo',
            'schema'       => [
                'description' => 'Resolved SEO metadata for the headless frontend.',
                'type'        => 'object',
                'context'     => ['view', 'edit'],
            ],
        ]);
    }
});

/**
 * Render the post in a front-end context and read back what the SEO plugin
 * actually produced. Reading post meta directly does not work: the live tags
 * are generated from templates, and the override fields are usually empty.
 *
 * @param array<string,mixed> $post
 * @return array<string,mixed>
 */
function storefaq_rest_seo(array $post): array
{
    $id = (int) ($post['id'] ?? 0);
    if ($id <= 0) {
        return [];
    }

    $cache_key = 'storefaq_seo_' . $id;
    $cached    = get_transient($cache_key);
    if (is_array($cached)) {
        return $cached;
    }

    $head = storefaq_capture_head($id);
    $seo  = storefaq_parse_head($head, $id);

    // Per-post overrides win when an editor has actually set one.
    foreach ([
        'canonical'         => '_thinkrank_canonical_url',
        'og_title'          => '_thinkrank_og_title',
        'og_description'    => '_thinkrank_og_description',
        'og_image'          => '_thinkrank_og_image',
        'twitter_title'     => '_thinkrank_twitter_title',
        'twitter_description' => '_thinkrank_twitter_description',
        'twitter_image'     => '_thinkrank_twitter_image',
    ] as $key => $meta_key) {
        $value = get_post_meta($id, $meta_key, true);
        if (is_string($value) && $value !== '') {
            $seo[$key] = $value;
        }
    }

    // Point canonicals at the Astro frontend, not the CMS host.
    if (!empty($seo['canonical'])) {
        $seo['canonical'] = storefaq_to_frontend($seo['canonical'], $id);
    }

    set_transient($cache_key, $seo, HOUR_IN_SECONDS);

    return $seo;
}

/**
 * Buffer wp_head() for a single post without emitting anything to the client.
 */
function storefaq_capture_head(int $id): string
{
    global $wp_query, $post;

    $original_query = $wp_query;
    $original_post  = $post;

    $post = get_post($id);
    if (!$post) {
        return '';
    }

    setup_postdata($post);

    $wp_query = new WP_Query([
        'p'         => $id,
        'post_type' => get_post_type($id) ?: 'post',
    ]);
    $wp_query->the_post();

    ob_start();
    do_action('wp_head');
    $head = (string) ob_get_clean();

    wp_reset_postdata();
    $wp_query = $original_query;
    $post     = $original_post;

    return $head;
}

/**
 * @return array<string,mixed>
 */
function storefaq_parse_head(string $head, int $id): array
{
    $meta = static function (string $attr, string $name) use ($head): string {
        $pattern = '#<meta[^>]*' . preg_quote($attr, '#')
            . '=["\']' . preg_quote($name, '#') . '["\'][^>]*content=["\'](.*?)["\']#is';
        if (preg_match($pattern, $head, $m)) {
            return html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
        }
        // content= may precede name=
        $pattern = '#<meta[^>]*content=["\'](.*?)["\'][^>]*' . preg_quote($attr, '#')
            . '=["\']' . preg_quote($name, '#') . '["\']#is';
        if (preg_match($pattern, $head, $m)) {
            return html_entity_decode($m[1], ENT_QUOTES, 'UTF-8');
        }
        return '';
    };

    $title = '';
    if (preg_match('#<title[^>]*>(.*?)</title>#is', $head, $m)) {
        $title = html_entity_decode(trim($m[1]), ENT_QUOTES, 'UTF-8');
    }

    $canonical = '';
    if (preg_match('#<link[^>]*rel=["\']canonical["\'][^>]*href=["\'](.*?)["\']#is', $head, $m)) {
        $canonical = $m[1];
    }

    return [
        'title'               => $title ?: get_the_title($id),
        'description'         => $meta('name', 'description'),
        'robots'              => $meta('name', 'robots'),
        'canonical'           => $canonical,
        'og_title'            => $meta('property', 'og:title'),
        'og_description'      => $meta('property', 'og:description'),
        'og_image'            => $meta('property', 'og:image'),
        'og_type'             => $meta('property', 'og:type'),
        'twitter_card'        => $meta('name', 'twitter:card'),
        'twitter_title'       => $meta('name', 'twitter:title'),
        'twitter_description' => $meta('name', 'twitter:description'),
        'twitter_image'       => $meta('name', 'twitter:image'),
    ];
}

/** Rewrite a CMS URL onto the public frontend, honouring the /blog/ move. */
function storefaq_to_frontend(string $url, int $id): string
{
    $path = (string) wp_parse_url($url, PHP_URL_PATH);
    if ($path === '') {
        return $url;
    }
    if (get_post_type($id) === 'post' && !str_starts_with($path, '/blog/')) {
        $path = '/blog' . $path;
    }
    return STOREFAQ_FRONTEND . $path;
}

/* -------------------------------------------------------------------------
 * 2. Drop the SEO cache whenever a post changes.
 * ---------------------------------------------------------------------- */

add_action('save_post', static function (int $id): void {
    delete_transient('storefaq_seo_' . $id);
}, 10, 1);

/* -------------------------------------------------------------------------
 * 3. Restrict blog editors to core blocks (guide §B1, editor guardrail).
 *    Keeps the sanitiser's job small and stops a plugin update from
 *    silently introducing new markup.
 * ---------------------------------------------------------------------- */

add_filter('allowed_block_types_all', static function ($allowed, $ctx) {
    if (!isset($ctx->post) || $ctx->post->post_type !== 'post') {
        return $allowed;
    }
    return [
        'core/paragraph', 'core/heading', 'core/list', 'core/list-item',
        'core/image', 'core/quote', 'core/table', 'core/code',
        'core/separator', 'core/embed', 'core/buttons', 'core/button',
    ];
}, 10, 2);

/* -------------------------------------------------------------------------
 * 4. Purge the Vercel cache on publish (guide §B6, adapted from Netlify).
 *    Set STOREFAQ_VERCEL_BYPASS_TOKEN in wp-config.php.
 * ---------------------------------------------------------------------- */

add_action('transition_post_status', static function ($new, $old, $post): void {
    if ($new !== 'publish' && $old !== 'publish') {
        return;
    }
    if (!defined('STOREFAQ_VERCEL_BYPASS_TOKEN')) {
        return;
    }

    $paths = ['/blog/', '/feed/', '/sitemap-blog.xml'];
    if ($post->post_type === 'post') {
        $paths[] = '/blog/' . $post->post_name . '/';
        foreach (wp_get_post_categories($post->ID) as $cat_id) {
            $term = get_term($cat_id);
            if ($term && !is_wp_error($term)) {
                $paths[] = '/category/' . $term->slug . '/';
            }
        }
    }

    // Revalidate by requesting each path with the bypass token, which
    // refreshes Vercel's ISR entry for that path.
    foreach (array_unique($paths) as $path) {
        wp_remote_get(STOREFAQ_FRONTEND . $path, [
            'timeout'  => 5,
            'blocking' => false,
            'headers'  => [
                'x-prerender-revalidate' => STOREFAQ_VERCEL_BYPASS_TOKEN,
            ],
        ]);
    }
}, 10, 3);
