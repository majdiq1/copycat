#!/usr/bin/env python3
"""
clipwatch — keeps a short history of what you copy, for the desktop widget.

Handles text AND images (screenshots). Everything stays on this Mac:
    ~/.cache/ai-usage/clipboard.json     the list
    ~/.cache/ai-usage/clips/             full-size images

Deliberately does NOT record things that look like credentials — API keys,
tokens, private keys. Filtering is pattern-based: a helpful precaution, not a
guarantee. A password that looks like an ordinary word will be stored.
"""
import base64
import hashlib
import json
import os
import re
import subprocess
import time

BASE = os.path.expanduser("~/.cache/ai-usage")
STORE = os.path.join(BASE, "clipboard.json")
CLIPS = os.path.join(BASE, "clips")
MAX_ITEMS = 40
MAX_LEN = 4000
THUMB_PX = 150          # thumbnail edge, inlined into the json as a data URL
POLL = 1.5

SECRET_PATTERNS = [
    re.compile(r"sk-ant-", re.I),
    re.compile(r"lin_api_", re.I),
    re.compile(r"\bsk-[A-Za-z0-9]{16,}", re.I),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{16,}"),
    re.compile(r"\bAKIA[0-9A-Z]{12,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{20,}\."),
]


def looks_secret(text):
    s = text.strip()
    if not s:
        return True
    for p in SECRET_PATTERNS:
        if p.search(s):
            return True
    if (len(s) >= 26 and " " not in s and "\n" not in s
            and re.fullmatch(r"[A-Za-z0-9_\-\.]+", s)
            and not s.startswith(("http", "/", "~", "."))
            and re.search(r"\d", s) and re.search(r"[A-Za-z]", s)):
        return True
    return False


def load():
    try:
        with open(STORE) as f:
            return json.load(f)
    except Exception:
        return []


def save(items):
    os.makedirs(BASE, exist_ok=True)
    items = items[:MAX_ITEMS]
    tmp = STORE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(items, f)
    os.replace(tmp, STORE)
    os.chmod(STORE, 0o600)
    # drop image files no longer referenced
    keep = {i.get("path") for i in items if i.get("path")}
    try:
        for n in os.listdir(CLIPS):
            p = os.path.join(CLIPS, n)
            if p not in keep:
                os.remove(p)
    except Exception:
        pass


def clip_text():
    try:
        return subprocess.run(["pbpaste"], capture_output=True,
                              timeout=5).stdout.decode("utf-8", "ignore")
    except Exception:
        return ""


def clip_png():
    """Return raw PNG bytes on the clipboard, or None."""
    try:
        r = subprocess.run(["osascript", "-e", "the clipboard as «class PNGf»"],
                           capture_output=True, timeout=8)
        out = r.stdout.decode("ascii", "ignore").strip()
    except Exception:
        return None
    # Decoding as ascii drops the « » guillemets osascript wraps the data in,
    # so match the payload itself rather than the delimiters.
    m = re.search(r"data PNGf([0-9A-Fa-f]{16,})", out)
    if not m:
        return None
    try:
        return bytes.fromhex(m.group(1))
    except ValueError:
        return None


def thumbnail(path):
    """Small base64 PNG for the widget to show inline."""
    out = path + ".thumb.png"
    try:
        subprocess.run(["sips", "-Z", str(THUMB_PX), path, "--out", out],
                       capture_output=True, timeout=15)
        with open(out, "rb") as f:
            b = base64.b64encode(f.read()).decode()
        os.remove(out)
        return "data:image/png;base64," + b
    except Exception:
        try:
            os.remove(out)
        except Exception:
            pass
        return None


def main():
    os.makedirs(CLIPS, exist_ok=True)
    items = load()
    last_text = clip_text()
    last_img = None

    while True:
        time.sleep(POLL)

        # --- text ---
        try:
            cur = clip_text()
        except Exception:
            cur = ""
        if cur.strip() and cur != last_text:
            last_text = cur
            last_img = None
            if not looks_secret(cur):
                text = cur[:MAX_LEN]
                items = [i for i in items if i.get("text") != text]
                items.insert(0, {"kind": "text", "text": text,
                                 "at": int(time.time() * 1000)})
                try:
                    save(items)
                except Exception:
                    pass
            continue

        # --- image (only when there's no text on the clipboard) ---
        if cur.strip():
            continue
        png = clip_png()
        if not png:
            continue
        digest = hashlib.sha256(png).hexdigest()[:16]
        if digest == last_img:
            continue
        last_img = digest
        path = os.path.join(CLIPS, digest + ".png")
        if not os.path.exists(path):
            try:
                with open(path, "wb") as f:
                    f.write(png)
                os.chmod(path, 0o600)
            except Exception:
                continue
        thumb = thumbnail(path)
        items = [i for i in items if i.get("path") != path]
        items.insert(0, {"kind": "image", "path": path, "thumb": thumb,
                         "bytes": len(png), "at": int(time.time() * 1000)})
        try:
            save(items)
        except Exception:
            pass


if __name__ == "__main__":
    main()
