#!/usr/bin/env bash
A="$HOME/Library/LaunchAgents/com.copycat.clipwatch.plist"
launchctl unload "$A" 2>/dev/null; rm -f "$A"
rm -f "$HOME/Library/Application Support/Übersicht/widgets/clipboard.jsx" "$HOME/.clipwatch.py"
rm -rf "$HOME/.cache/ai-usage/clips" "$HOME/.cache/ai-usage/clipboard.json"
echo "Watcher stopped, widget and history removed."
