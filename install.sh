#!/usr/bin/env bash
set -euo pipefail
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WIDGETS="$HOME/Library/Application Support/Übersicht/widgets"
say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
[ "$(uname)" = "Darwin" ] || { echo "macOS only."; exit 1; }

say "Übersicht"
if [ -d "/Applications/Übersicht.app" ]; then ok "already installed"
elif command -v brew >/dev/null 2>&1; then brew install --cask ubersicht && ok "installed"
else warn "install it from https://tracesof.net/uebersicht/ then run this again"; exit 1; fi
mkdir -p "$WIDGETS"

say "Widget"
cp "$SRC/widget/clipboard.jsx" "$WIDGETS/clipboard.jsx"; ok "clipboard.jsx"

say "Watcher"
cp "$SRC/bin/clipwatch.py" "$HOME/.clipwatch.py"; chmod +x "$HOME/.clipwatch.py"
mkdir -p "$HOME/.cache/ai-usage"
AGENT="$HOME/Library/LaunchAgents/com.copycat.clipwatch.plist"
cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.copycat.clipwatch</string>
  <key>ProgramArguments</key>
  <array><string>/usr/bin/python3</string><string>$HOME/.clipwatch.py</string></array>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardErrorPath</key><string>/tmp/clipwatch.err</string>
</dict>
</plist>
PLIST
launchctl unload "$AGENT" 2>/dev/null || true
launchctl load "$AGENT"; sleep 2
pgrep -f clipwatch.py >/dev/null && ok "running" || warn "did not start — see /tmp/clipwatch.err"
echo
warn "This records what you copy. Read the Privacy section of the README."

say "Done"
echo "  Übersicht menu bar → Refresh All Widgets"
echo "  Remove it again with ./uninstall.sh"
