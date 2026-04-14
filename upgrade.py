#!/usr/bin/env python3
"""
upgrade.py - Check and update hardcoded software versions in this project.

Targets:
  - Debian forky slim -> docker/Dockerfile
  - Claude Code       -> docker/Dockerfile

Usage:
  python3 upgrade.py
"""

import datetime
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

WORKSPACE = Path(__file__).parent

DOCKERFILE = WORKSPACE / "docker" / "Dockerfile"


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def fetch_json(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"HTTP {e.code} fetching {url}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error fetching {url}: {e.reason}") from e


# ---------------------------------------------------------------------------
# Version fetchers
# ---------------------------------------------------------------------------

def get_latest_debian_forky_slim():
    """Return the latest forky-YYYYMMDD-slim tag from Docker Hub."""
    url = (
        "https://hub.docker.com/v2/repositories/library/debian/tags"
        "?name=forky-&ordering=last_updated&page_size=100"
    )
    data = fetch_json(url)
    pattern = re.compile(r"^forky-(\d{8})-slim$")
    candidates = []
    for result in data.get("results", []):
        m = pattern.match(result["name"])
        if m:
            candidates.append((m.group(1), result["name"]))
    if not candidates:
        raise RuntimeError("No forky-YYYYMMDD-slim tags found on Docker Hub")
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]  # e.g. "forky-20260223-slim"


def get_latest_claude_code():
    """Return the latest @anthropic-ai/claude-code version from the npm registry."""
    data = fetch_json("https://registry.npmjs.org/@anthropic-ai/claude-code/latest")
    return data["version"]  # e.g. "1.2.3"


# ---------------------------------------------------------------------------
# File helpers
# ---------------------------------------------------------------------------

def read_current(path, pattern):
    """Extract current value using a regex with one capture group."""
    content = path.read_text()
    m = re.search(pattern, content)
    if not m:
        raise RuntimeError(f"Pattern {pattern!r} not found in {path}")
    return m.group(1)


def update_file(path, pattern, replacement, count=1):
    """Replace regex match(es) in file. Returns True if content changed."""
    content = path.read_text()
    new_content, n = re.subn(pattern, replacement, content, count=count)
    if n == 0:
        raise RuntimeError(f"Pattern {pattern!r} not found in {path}")
    if new_content == content:
        return False
    path.write_text(new_content)
    return True


# ---------------------------------------------------------------------------
# Per-tool check + update logic
# ---------------------------------------------------------------------------

def check(name, current, latest, path, search_pattern, replacement, count=1):
    if current == latest:
        print(f"  ok        {current}")
        return False
    print(f"  outdated  {current} -> {latest}")
    changed = update_file(path, search_pattern, replacement, count=count)
    if changed:
        print(f"  updated   {path.relative_to(WORKSPACE)}")
    return changed


def run_debian_forky():
    print("[debian forky slim]")
    current = read_current(DOCKERFILE, r"FROM debian:(\S+)")
    latest  = get_latest_debian_forky_slim()
    changed = check(
        "debian", current, latest,
        DOCKERFILE,
        r"FROM debian:\S+",
        f"FROM debian:{latest}",
    )
    if changed:
        today = datetime.date.today().strftime("%y%m%d")
        update_file(DOCKERFILE, r'LABEL version="\S+"', f'LABEL version="{today}"')
        print(f"  updated   LABEL version -> {today}")
        update_file(DOCKERFILE, r"ENV TAYRAX_UPGRADE=\S+", f"ENV TAYRAX_UPGRADE={today}")
        print(f"  updated   TAYRAX_UPGRADE -> {today}")
    return changed


def run_claude_code():
    print("[claude-code]")
    current = read_current(DOCKERFILE, r"ENV TAYRAX_CLAUDE_UPGRADE=(\S+)")
    latest  = get_latest_claude_code()
    return check(
        "claude-code", current, latest,
        DOCKERFILE,
        r"ENV TAYRAX_CLAUDE_UPGRADE=\S+",
        f"ENV TAYRAX_CLAUDE_UPGRADE={latest}",
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

CHECKS = [
    run_debian_forky,
    run_claude_code,
]


def main():
    any_updated = False
    any_error   = False

    for fn in CHECKS:
        try:
            updated = fn()
            any_updated = any_updated or updated
        except Exception as e:
            print(f"  ERROR: {e}")
            any_error = True
        print()

    if any_error:
        print("Finished with errors.")
        sys.exit(1)
    elif any_updated:
        print("All updates applied.")
    else:
        print("Everything is up to date.")


if __name__ == "__main__":
    main()
