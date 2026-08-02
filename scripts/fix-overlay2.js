const fs = require('fs');

// ─── 1. Fix dashboard.js ───
let dash = fs.readFileSync('public/js/dashboard.js', 'utf8');

// In the template literal (backtick string), double quotes are unescaped
const fpStart = '<div class="chat-file-preview hidden" id="filePreview_${userId}">';
const fpEnd = '<div class="voice-recording-overlay hidden" id="recordingOverlay_${userId}">';

let s1 = dash.indexOf(fpStart);
if (s1 === -1) {
  console.log('ERROR: Could not find file preview start');
  process.exit(1);
}

let e1 = dash.indexOf(fpEnd, s1);
if (e1 === -1) {
  console.log('ERROR: Could not find voice-recording-overlay after file preview');
  process.exit(1);
}

// Find the closing </div> of the file preview (the one right before voice-recording-overlay)
let lastDivClose = dash.lastIndexOf('</div>', e1);
let afterPreviewDiv = lastDivClose + '</div>'.length;

// The file preview block including its closing </div>
const fpBlock = dash.slice(s1, afterPreviewDiv);

// Input area closing pattern (uses \r\n line endings)
const inputAreaCloser = '</div>\r\n    </div>\r\n  `;\n\n  const container';
let closerIdx = dash.indexOf(inputAreaCloser);
if (closerIdx === -1) {
  console.log('ERROR: Could not find input-area closer');
  process.exit(1);
}

let removedLen = afterPreviewDiv - s1;

// Remove the file preview block from current position
let modified = dash.slice(0, s1) + dash.slice(afterPreviewDiv);

// Adjust closerIdx (shifted left if preview was before it)
if (closerIdx > s1) {
  closerIdx -= removedLen;
}

// Insert the preview block after the input-area closing div
const insertPos = closerIdx + inputAreaCloser.length;
modified = modified.slice(0, insertPos) + '\n      ' + fpBlock.trim() + '\n    ' + modified.slice(insertPos);

fs.writeFileSync('public/js/dashboard.js', modified, 'utf8');
console.log('✅ dashboard.js: moved file preview out of input area');

// ─── 2. Fix style.css ───
let css = fs.readFileSync('public/css/style.css', 'utf8');

const oldCssStart = '/* File preview fills the chat window from input to header */';
const newCss = `/* File preview overlays the entire chat window */
.chat-file-preview {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: inherit;
  padding: 0;
  overflow: hidden;
  z-index: 100;
  animation: slideUpFade 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.chat-file-preview.hidden {
  display: none;
}`;

const oldEnd = '.chat-file-preview.hidden {\n  display: none;\n}';

let cssIdx = css.indexOf(oldCssStart);
if (cssIdx === -1) {
  console.log('ERROR: Could not find file preview CSS in style.css');
  process.exit(1);
}

let cssEndIdx = css.indexOf(oldEnd, cssIdx);
if (cssEndIdx === -1) {
  console.log('ERROR: Could not find end of file preview CSS');
  process.exit(1);
}

cssEndIdx += oldEnd.length;

css = css.slice(0, cssIdx) + newCss + '\n\n' + css.slice(cssEndIdx);

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('✅ style.css: updated file preview to overlay entire chat window');
console.log('✅ Done!');
