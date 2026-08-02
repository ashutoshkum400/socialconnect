const fs = require('fs');

// ─── 1. MOVE HTML: dashboard.js ────────────────────────────────────────
let js = fs.readFileSync('public/js/dashboard.js', 'utf8');

// Find the preview block
const previewStartMarker = 'class="chat-file-preview hidden" id="filePreview_';
const previewIdx = js.indexOf(previewStartMarker);
if (previewIdx === -1) {
  console.error('Could not find chat-file-preview in dashboard.js');
  process.exit(1);
}
console.log('Found preview class at index:', previewIdx);

// Walk back to find the opening <div
const previewOpenDiv = js.lastIndexOf('<div', previewIdx);
console.log('Preview open div at index:', previewOpenDiv);

// Find the end of the preview block: the </div> before voice-recording-overlay
const voiceOverlayIdx = js.indexOf('voice-recording-overlay hidden', previewIdx);
if (voiceOverlayIdx === -1) {
  console.error('Could not find voice-recording-overlay after preview');
  process.exit(1);
}
console.log('Voice overlay at index:', voiceOverlayIdx);

const previewBlockEnd = js.lastIndexOf('</div>', voiceOverlayIdx - 10);
if (previewBlockEnd === -1) {
  console.error('Could not find end of preview block');
  process.exit(1);
}
console.log('Preview block end at index:', previewBlockEnd);

// Extract the preview block
const previewBlock = js.slice(previewOpenDiv, previewBlockEnd + 6);
console.log('Preview block length:', previewBlock.length);

// Remove the preview block from its current location
js = js.slice(0, previewOpenDiv) + js.slice(previewBlockEnd + 6);

// Find the template literal closing backtick
const backtickMarker = '`;';
const audioIdx = js.indexOf('voicePreviewAudio');
if (audioIdx === -1) {
  console.error('Could not find voicePreviewAudio');
  process.exit(1);
}

const lastBacktick = js.indexOf(backtickMarker, audioIdx);
if (lastBacktick === -1) {
  console.error('Could not find template closing backtick');
  process.exit(1);
}
console.log('Template backtick at index:', lastBacktick);

// Insert the preview block before the backtick
js = js.slice(0, lastBacktick) + '\n      ' + previewBlock + '\n    ' + js.slice(lastBacktick);

fs.writeFileSync('public/js/dashboard.js', js, 'utf8');
console.log('✅ dashboard.js: Moved chat-file-preview to end of chat-window');

// ─── 2. UPDATE CSS: style.css ────────────────────────────────────────
let css = fs.readFileSync('public/css/style.css', 'utf8');

const cssMarkers = [
  '/* File preview fills the chat window from input to header */',
  '/* File preview fills the chat window',
  '/* File preview above input area',
];

let cssStartIdx = -1;
for (const marker of cssMarkers) {
  cssStartIdx = css.indexOf(marker);
  if (cssStartIdx !== -1) break;
}

if (cssStartIdx === -1) {
  console.error('Could not find CSS marker for chat-file-preview');
  process.exit(1);
}

// Find the end of the CSS block: next blank line after the block
const afterBlock = css.indexOf('\n\n', cssStartIdx + 100);
if (afterBlock === -1) {
  console.error('Could not find CSS block end');
  process.exit(1);
}

const newCss = `/* File preview overlays the entire chat window */
.chat-file-preview {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-radius: 0;
  box-shadow: none;
  border: none;
  padding: 0;
  min-height: 80px;
  max-height: none;
  overflow-y: auto;
  z-index: 50;
  animation: slideUpFade 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}`;

css = css.slice(0, cssStartIdx) + newCss + css.slice(afterBlock);

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('✅ style.css: Updated chat-file-preview CSS');
