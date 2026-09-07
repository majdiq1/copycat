// Clipboard history — click any entry to put it back on the clipboard.
// Handles text and images (screenshots).
//
// Fed by ~/.clipwatch.py, running via LaunchAgent com.majdi.clipwatch.
// Things that look like API keys are never recorded.
//
// Clear everything:  echo '[]' > ~/.cache/ai-usage/clipboard.json

import { css, run } from "uebersicht";

/* ─── config ─────────────────────────────────────────────── */

// Sits directly above the usage widget, in the same bottom-left column.
// The column is tight — raising SHOW or LIST_HEIGHT will push this off
// the top of the screen.
const POSITION = "bottom: 40px; right: 36px;";
const WIDTH = 380;        // matches Linear and usage so the column lines up
const HEIGHT = 230;   // fixed so the column spaces evenly
const SHOW = 5;
const LIST_HEIGHT = 194;

export const refreshFrequency = 3000; // feels instant after a copy

export const command =
  "cat \"$HOME/.cache/ai-usage/clipboard.json\" 2>/dev/null || echo '[]'";

/* ─── styles ─────────────────────────────────────────────── */

export const className = `
  ${POSITION}
  width: ${WIDTH}px;
  height: ${HEIGHT}px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
  color: #E9EDF5;
  background: rgba(20, 25, 36, 0.82);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  -webkit-font-smoothing: antialiased;
`;

const head = css`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 12px 16px 9px;
`;

const mark = css`
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.1px;
`;

const count = css`
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: #8B95AB;
`;

const list = css`
  max-height: ${LIST_HEIGHT}px;
  overflow-y: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.12);
    border-radius: 3px;
  }
`;

const row = css`
  display: grid;
  grid-template-columns: 1fr 40px;
  align-items: center;
  gap: 9px;
  padding: 7px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  &:hover { background: rgba(255, 255, 255, 0.06); }
  &:hover .copyhint { opacity: 1; }
  &:hover .stamp { opacity: 0; }
  &:last-child { border-bottom: none; }
`;

const text = css`
  font-size: 11.5px;
  line-height: 1.35;
  color: #E9EDF5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  word-break: break-word;
`;

const imgRow = css`
  display: flex;
  align-items: center;
  gap: 9px;
  overflow: hidden;
`;

const thumb = css`
  height: 30px;
  width: 44px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  flex: none;
`;

const imgLabel = css`
  font-size: 11.5px;
  color: #8B95AB;
`;

const cell = css`
  position: relative;
  text-align: right;
`;

const stamp = css`
  font-size: 9.5px;
  font-variant-numeric: tabular-nums;
  color: #5A6478;
`;

const hint = css`
  opacity: 0;
  position: absolute;
  right: 0;
  top: 0;
  font-size: 9.5px;
  color: #4E9E7C;
`;

const panel = css`
  padding: 14px 16px;
  font-size: 11.5px;
  line-height: 1.5;
  color: #8B95AB;
`;

/* ─── helpers ────────────────────────────────────────────── */

function ago(ms, now) {
  var m = Math.floor((now - ms) / 60000);
  if (m < 1) return "now";
  if (m < 60) return m + "m";
  var h = Math.floor(m / 60);
  if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
}

function preview(s) {
  return String(s).replace(/\s+/g, " ").trim();
}

function size(bytes) {
  if (!bytes) return "image";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

// Restore entry i. Text goes straight to pbcopy; images are handed back to
// the pasteboard as PNG. Reading from the store by index avoids any quoting
// trouble with newlines, quotes or unicode in the copied text.
function restore(i) {
  return (
    "python3 -c \"import json,os,subprocess;" +
    "d=json.load(open(os.path.expanduser('~/.cache/ai-usage/clipboard.json')));" +
    "e=d[" + i + "];" +
    "subprocess.run(['osascript','-e'," +
    "'set the clipboard to (read (POSIX file \\\\\\\"'+e['path']+'\\\\\\\") as ' + chr(171) + 'class PNGf' + chr(187) + ')'])" +
    " if e.get('kind')=='image' else " +
    "subprocess.run(['pbcopy'],input=e['text'].encode())\""
  );
}

/* ─── render ─────────────────────────────────────────────── */

export const render = function (props) {
  if (props.error) {
    return <div className={panel}>Watcher error: {String(props.error)}</div>;
  }

  var items;
  try {
    items = JSON.parse(props.output || "[]");
  } catch (e) {
    return <div className={panel}>Couldn't read the history file.</div>;
  }

  if (!items.length) {
    return (
      <div>
        <div className={head}>
          <span className={mark}>Clipboard</span>
        </div>
        <div className={panel}>Nothing yet. Copy something and it appears here.</div>
      </div>
    );
  }

  var now = Date.now();

  return (
    <div>
      <div className={head}>
        <span className={mark}>Clipboard</span>
        <span className={count}>{items.length} saved</span>
      </div>
      <div className={list}>
        {items.slice(0, SHOW).map(function (item, i) {
          var isImage = item.kind === "image";
          return (
            <div
              key={i}
              className={row}
              onClick={function () {
                run(restore(i));
              }}
            >
              {isImage ? (
                <span className={imgRow}>
                  {item.thumb ? (
                    <img className={thumb} src={item.thumb} alt="" />
                  ) : null}
                  <span className={imgLabel}>Screenshot · {size(item.bytes)}</span>
                </span>
              ) : (
                <span className={text}>{preview(item.text)}</span>
              )}
              <span className={cell}>
                <span className={"stamp " + stamp}>{ago(item.at, now)}</span>
                <span className={"copyhint " + hint}>copy</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
