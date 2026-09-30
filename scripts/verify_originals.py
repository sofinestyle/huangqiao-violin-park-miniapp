#!/usr/bin/env python3
"""Read-only verification against the immutable initialization manifest."""

import hashlib
import json
import sys
from pathlib import Path


def main():
    project_root = Path(__file__).resolve().parents[1]
    manifest_path = project_root / "docs" / "原始文件清单.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(f"无法读取原始文件清单：{exc}", file=sys.stderr)
        return 1

    failures = []
    for item in manifest["files"]:
        target = project_root / item["path"]
        try:
            content = target.read_bytes()
        except OSError as exc:
            failures.append(f'{item["path"]}：文件缺失或不可读（{exc}）')
            continue
        if len(content) != item["bytes"]:
            failures.append(f'{item["path"]}：文件大小变化')
        if hashlib.sha256(content).hexdigest() != item["sha256"]:
            failures.append(f'{item["path"]}：SHA-256变化')

    if failures:
        print("原件校验失败；请核查变化，不得更新基线掩盖修改：")
        print("\n".join(failures))
        return 1
    print(f'原件校验通过：{len(manifest["files"])}份业务文件，大小及SHA-256均一致。')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
