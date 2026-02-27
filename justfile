set shell := ["bash", "-euo", "pipefail", "-c"]

app recipe:
    cd app && just {{ recipe }}

cli cmd:
    cd cli && cargo run -- {{ cmd }}

check:
    cargo clippy
    cargo check
    cd app && just check

prune-local-branches dry_run="true":
    #!/usr/bin/env bash
    git switch main
    git pull --ff-only
    gh pr list --state merged --limit 1000 --json headRefName \
        --jq '.[].headRefName' | tr -d '\r' \
        | while IFS=$'\t' read -r br; do
            [ -n "${br:-}" ] || continue

            # Only delete if the branch exists locally
            if git show-ref --verify --quiet "refs/heads/$br"; then
              if [[ "{{ dry_run }}" == "true" ]]; then
                echo "would delete: $br"
              else
                # Try safe delete first, then force
                if git branch -d "$br" >/dev/null 2>&1; then
                  echo "deleted: $br"
                else
                  git branch -D "$br" >/dev/null
                  echo "force-deleted: $br"
                fi
              fi
            fi
          done
