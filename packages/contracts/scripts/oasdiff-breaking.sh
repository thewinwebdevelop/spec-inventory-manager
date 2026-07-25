#!/usr/bin/env bash
# Contract breaking-change gate (backend.md §3.6, §5.2 item 5). Compares the
# CURRENT OpenAPI spec against its version at the merge-base with the target
# branch and FAILS on any breaking change. Complements the existing
# `contracts-drift` job (which catches "forgot to regen") — this one catches
# "changed the contract in a way that breaks a shipped client".
#
# Evolution rule (§3.6): additive-only after a client ships; removing/renaming a
# field, tightening a type, adding a required request field, deleting a path or
# response are BREAKING and must go through deprecation (skill contract-evolution).
#
# Runner resolution (pragmatic — no new npm dep): use an `oasdiff` binary if one
# is on PATH, otherwise the official `tufin/oasdiff` Docker image. If neither is
# available the script exits non-zero and says so — it never silently passes.
set -euo pipefail

SPEC_REL="packages/contracts/openapi/openapi.yaml"
REPO_ROOT="$(git rev-parse --show-toplevel)"
SPEC="$REPO_ROOT/$SPEC_REL"
OASDIFF_IMAGE="${OASDIFF_IMAGE:-tufin/oasdiff:latest}"

# Base ref: explicit arg > env > CI base branch > origin/main.
BASE_REF="${1:-${OASDIFF_BASE_REF:-}}"
if [ -z "$BASE_REF" ]; then
  if [ -n "${GITHUB_BASE_REF:-}" ]; then
    BASE_REF="origin/${GITHUB_BASE_REF}"
  else
    BASE_REF="origin/main"
  fi
fi

echo "oasdiff: base ref = ${BASE_REF}"

# Merge-base so we only judge THIS branch's changes, not commits that landed on
# the base after we branched. Fall back to the ref itself if merge-base fails.
MERGE_BASE="$(git merge-base "$BASE_REF" HEAD 2>/dev/null || echo "$BASE_REF")"
echo "oasdiff: merge-base = ${MERGE_BASE}"

if ! git cat-file -e "${MERGE_BASE}:${SPEC_REL}" 2>/dev/null; then
  echo "oasdiff: spec did not exist at ${MERGE_BASE} — nothing to diff (all-additive). PASS."
  exit 0
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
git show "${MERGE_BASE}:${SPEC_REL}" > "${WORKDIR}/base.yaml"
cp "$SPEC" "${WORKDIR}/revision.yaml"

run_oasdiff() {
  # $1 base, $2 revision (absolute paths)
  if command -v oasdiff >/dev/null 2>&1; then
    echo "oasdiff: using local binary ($(command -v oasdiff))"
    oasdiff breaking "$1" "$2" --fail-on ERR
    return $?
  fi
  if command -v docker >/dev/null 2>&1; then
    echo "oasdiff: using Docker image ${OASDIFF_IMAGE}"
    docker run --rm -v "${WORKDIR}:/specs" "${OASDIFF_IMAGE}" \
      breaking /specs/base.yaml /specs/revision.yaml --fail-on ERR
    return $?
  fi
  echo "::error::oasdiff: neither an 'oasdiff' binary nor Docker is available — cannot run the breaking-change gate." >&2
  return 2
}

echo "oasdiff: comparing ${SPEC_REL} (merge-base → working tree)…"
if run_oasdiff "${WORKDIR}/base.yaml" "${WORKDIR}/revision.yaml"; then
  echo "oasdiff: no breaking changes. PASS."
  exit 0
else
  status=$?
  echo "::error::oasdiff detected breaking OpenAPI changes (exit ${status}). If intentional, follow the deprecation path (skill contract-evolution)." >&2
  exit "$status"
fi
