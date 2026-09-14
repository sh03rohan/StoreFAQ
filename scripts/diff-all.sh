#!/usr/bin/env bash
# Runs every diff and prints one line each.
#
# It reports a script that produced NO summary line as a failure rather than a
# blank. That has bitten twice: /docs/ stopped reaching `networkidle` and died
# on a timeout, and the loop printed an empty line that read like a pass. A
# diff that cannot run is not a diff that passed.
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="${1:-http://localhost:4321}"
if ! curl -sf -o /dev/null --max-time 5 "$BASE/"; then
  echo "dev server not answering at $BASE — start it with: npm run dev"
  exit 1
fi

SCRIPTS=(diff-section diff-features diff-cta diff-testimonials diff-faq diff-pricing
         diff-chrome diff-footer diff-features-page diff-home-page diff-docs
         diff-changelog diff-privacy diff-feature-request diff-doc diff-doc-category
         diff-blog diff-post)

# The reference is somebody's PRODUCTION site. Each diff loads it once per
# viewport, so the whole suite is ~100 page loads; run back to back it gets
# rate-limited and the last few scripts time out — which looks exactly like a
# regression and is not one. Hence the pause between scripts and the single
# retry after a longer one. Run an individual diff directly while iterating;
# save the suite for checking the whole thing.
PACE="${PACE:-10}"
RETRY_PAUSE="${RETRY_PAUSE:-60}"

run_one() {
  if [ "$1" = "diff-section" ]; then node "scripts/$1.mjs" hero 2>&1
  else node "scripts/$1.mjs" 2>&1; fi
}

status=0
first=1
for s in "${SCRIPTS[@]}"; do
  [ $first -eq 1 ] || sleep "$PACE"
  first=0
  out=$(run_one "$s")
  line=$(printf '%s' "$out" | grep -Ei 'worst' | tail -1)
  if [ -z "$line" ]; then
    printf '%-22s no result, backing off %ss and retrying once\n' "$s" "$RETRY_PAUSE"
    sleep "$RETRY_PAUSE"
    out=$(run_one "$s")
    line=$(printf '%s' "$out" | grep -Ei 'worst' | tail -1)
  fi
  if [ -z "$line" ]; then
    status=1
    printf '%-22s DID NOT REPORT\n' "$s"
    printf '%s\n' "$out" | tail -6 | sed 's/^/    /'
  else
    printf '%-22s %s\n' "$s" "$line"
  fi
done

echo
echo "Expected, and documented in NOTES.md:"
echo "  diff-features 65   mobile card-gap normalisation"
echo "  diff-pricing  151  the accepted 360px shortfall"
echo "  diff-home-page 151 same, via the page total"
echo "  diff-footer   40   newsletter form at 360"
echo "  everything else 0-2px"
exit $status
