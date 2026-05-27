#!/usr/bin/env bash
set -euo pipefail

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "This is not a git repository."
  exit 1
fi

current_branch="$(git branch --show-current)"
if [[ -z "$current_branch" ]]; then
  echo "Cannot deploy from a detached HEAD."
  exit 1
fi

if [[ -z "$(git status --porcelain)" ]]; then
  echo "No local changes to commit."
  exit 0
fi

read -r -p "Enter commit message: " commit_message
if [[ -z "$commit_message" ]]; then
  echo "Commit message is required."
  exit 1
fi

npm run lint
npm test -- --run
npm run build

git add .
git commit -m "$commit_message"
git push -u origin "$current_branch"
npm run deploy
