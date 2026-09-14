#!/usr/bin/env bash
# Guide §B1 enforcement gate — must exit 0.
#
# Usage:
#   scripts/assert-clean.sh                 # check dist/
#   scripts/assert-clean.sh https://host/p  # check a rendered SSR page
#
# The guide's version greps only for wp-|eb-|elementor|is-layout-. Verified
# against real post content, that passes while genuine WordPress markup
# survives (is-style-*, has-fixed-layout, thinkrank-*, betterdocs-*, ff-*).
# Those are included here.
set -uo pipefail

FAIL=0
PATTERN='(wp-|eb-|is-layout-|is-style-|is-type-|is-provider-|has-fixed-layout|elementor|essential-blocks|thinkrank-|betterdocs-|fluentform|notificationx|nx-)'

report() { echo "FAIL: $1"; shift; printf '  %s\n' "$@" | head -20; FAIL=1; }

check_stream() {                 # $1 = label, stdin = html
  local label="$1" html
  html="$(cat)"

  # Class attributes carrying builder or plugin names.
  local hits
  hits="$(printf '%s' "$html" | grep -oE 'class="[^"]*'"$PATTERN"'[^"]*"' | sort -u)"
  [ -n "$hits" ] && report "WordPress markup in $label" "$hits"

  # The CMS host must never appear in public HTML.
  hits="$(printf '%s' "$html" | grep -oE 'cms\.storefaq\.io[^"'"'"' ]*' | sort -u)"
  [ -n "$hits" ] && report "CMS domain leaked into $label" "$hits"

  # WP paths, except the proxied uploads directory.
  hits="$(printf '%s' "$html" | grep -oE '(wp-admin|wp-json|wp-includes|xmlrpc\.php|\?p=[0-9]+)[^"'"'"' ]*' | sort -u)"
  [ -n "$hits" ] && report "WordPress path in $label" "$hits"

  # Plugin stylesheets.
  hits="$(printf '%s' "$html" | grep -oE '<link[^>]+(plugins|themes)/[^>]+>' | sort -u)"
  [ -n "$hits" ] && report "WordPress stylesheet in $label" "$hits"

  return 0
}

if [ $# -gt 0 ]; then
  for url in "$@"; do
    echo "checking $url"
    curl -fsSL "$url" | check_stream "$url"
  done
else
  [ -d dist ] || { echo "FAIL: dist/ not found — run npm run build first"; exit 1; }
  echo "checking dist/ ($(find dist -name '*.html' | wc -l | tr -d ' ') html files)"
  find dist -name '*.html' -print0 | while IFS= read -r -d '' f; do
    cat "$f"
  done | check_stream "dist/"

  # Candidates for review rather than a failure — some are legitimately files.
  echo
  echo "internal links without a trailing slash (review, not a failure):"
  grep -rEoh 'href="/[a-z0-9-]+(/[a-z0-9-]+)*"' dist --include='*.html' 2>/dev/null \
    | grep -v '\.' | sort -u | head -20
fi

if [ "$FAIL" -eq 0 ]; then
  echo "OK: no WordPress markup in output"
fi

# Phase 7 / Phase 8 gate: nothing in the output may point at WordPress — not a
# class, and not a URL either. 94 hotlinked doc screenshots passed the class
# grep above without a murmur; this is the check that would have caught them.
if [ -d dist/client ]; then
  echo
  wp_urls=$(grep -rhoE '(src|href|content|srcset)="[^"]*(wp-content|wp-json|wp-includes|cms\.storefaq\.io)[^"]*"' dist/client --include='*.html' | sort -u)
  if [ -n "$wp_urls" ]; then
    echo "FAIL: WordPress URLs in the output:"
    echo "$wp_urls" | head -20 | sed 's/^/  /'
    FAIL=1
  else
    echo "OK: no WordPress URL in the output"
  fi
fi

# Phase 6 gate: the blog is rendered on demand, so it is not in dist/ and the
# checks above never see it. Rendered pages are checked through the dev server
# when one is up — every listing state and the longest post — with the URL
# check as well as the class check. `BLOG_BASE` points it elsewhere.
BLOG_BASE="${BLOG_BASE:-http://localhost:4321}"
if curl -fs -o /dev/null --max-time 5 "$BLOG_BASE/blog/"; then
  echo
  for path in /blog/ /blog/page/2/ /category/guide/ "/blog/search/?s=schema" /blog/faq-schema-and-product-schema-shopify-ai-search/ /feed/; do
    echo "checking rendered $path"
    html="$(curl -fsSL "$BLOG_BASE$path")"
    # The feed keeps WordPress's `?p=ID` as each item's <guid>: it is an opaque
    # id, not a link, and changing it would make every reader already
    # subscribed re-deliver the last ten posts as new. Exempt, deliberately.
    printf '%s' "$html" | sed -E 's#<guid[^>]*>[^<]*</guid>##g' | check_stream "$path"
    hits="$(printf '%s' "$html" | grep -oE '(src|href|content|srcset)="[^"]*(wp-content|wp-json|wp-includes|cms\.storefaq\.io)[^"]*"' | sort -u)"
    [ -n "$hits" ] && report "WordPress URL in rendered $path" "$hits"
  done
else
  echo
  echo "skipping the rendered blog check: nothing at $BLOG_BASE (start astro dev, or set BLOG_BASE)"
fi

# The <head> is the half of the page no pixel diff can see, and it is the half
# search engines read. Every difference from the original must be an accounted
# one — see the classification in the script.
if [ -d dist/client ]; then
  echo
  node scripts/diff-head.mjs > /tmp/head-diff.txt 2>&1 || { cat /tmp/head-diff.txt; FAIL=1; }
  tail -2 /tmp/head-diff.txt
fi

# Every URL WordPress serves today must resolve, and in one hop. Reads the
# rules back out of the BUILT routing table, because the first version of that
# map emitted patterns that could never match and nothing in the source said so.
if [ -f .vercel/output/config.json ]; then
  echo
  node scripts/assert-redirects.mjs || FAIL=1
else
  echo
  echo "skipping the redirect check: no .vercel/output/config.json (run astro build)"
fi

exit "$FAIL"
