#!/usr/bin/env python3
"""
release.py - Set the release version in package.json and static/manifest.json.

Usage:
  python3 release.py <version>

Example:
  python3 release.py 0.2.0
"""

import json
import re
import sys
from pathlib import Path

WORKSPACE = Path(__file__).parent

PACKAGE_JSON  = WORKSPACE / "package.json"
MANIFEST_JSON = WORKSPACE / "static" / "manifest.json"

VERSION_RE = re.compile(r"^\d+\.\d+(\.\d+)?(-\d+)?$")


def update_package_json(version):
    data = json.loads(PACKAGE_JSON.read_text())
    current = data.get("version", "")
    if current == version:
        print(f"  unchanged  package.json ({version})")
        return
    data["version"] = version
    PACKAGE_JSON.write_text(json.dumps(data, indent=2) + "\n")
    print(f"  updated    package.json  {current} -> {version}")


def update_manifest_json(version):
    data = json.loads(MANIFEST_JSON.read_text())
    current = data.get("version", "")
    if current == version:
        print(f"  unchanged  static/manifest.json ({version})")
        return
    data["version"] = version
    data["version_name"] = version
    MANIFEST_JSON.write_text(json.dumps(data, indent=2) + "\n")
    print(f"  updated    static/manifest.json  {current} -> {version}")


def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <version>", file=sys.stderr)
        sys.exit(1)

    version = sys.argv[1]
    if not VERSION_RE.match(version):
        print(f"error: invalid version {version!r} (expected x.y, x.y.z, or x.y.z-n)", file=sys.stderr)
        sys.exit(1)

    update_package_json(version)
    update_manifest_json(version)


if __name__ == "__main__":
    main()
