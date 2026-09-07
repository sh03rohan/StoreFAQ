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
PATTERN='(wp-|eb-|is-layout-|is-style-|has-fixed-layout|elementor|essential-blocks|thinkrank-|betterdocs-|fluentform|notificationx|nx-)'

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
exit "$FAIL"
