const fs = require('fs');
const path = require('path');

// ─── 1. Move .chat-file-preview in dashboard.js ───────────────────────────
const jsPath = path.join(__dirname, '..', 'public', 'js', 'dashboard.js');
let js = fs.readFileSync(jsPath, 'utf8');

// Find the chat-file-preview block inside chat-window__input-area
// It's between the </div> closing chat-window__input-area and actually inside it
// Target pattern: find `<div class="chat-file-preview hidden"` and move it after `</div>\n  `; (closing of input-area)

// Step 1: Remove the chat-file-preview block from inside input-area
const previewStart = '<div class="chat-file-preview hidden" id="filePreview_${userId}">';
const previewEnd = '</div>'; // The closing div of the preview

const previewIdx = js.indexOf(previewStart);
if (previewIdx === -1) {
  console.error('ERROR: Could not find chat-file-preview in dashboard.js');
  process.exit(1);
}

// Find the matching closing </div> for the preview (it's the 4th </div> after the preview start, within a limited range)
const previewBlockEnd = js.indexOf('</div>\n      </div>\n      <div class="voice-recording-overlay', previewIdx);
if (previewBlockEnd === -1) {
  console.error('ERROR: Could not find end of chat-file-preview block');
  process.exit(1);
}

const previewBlock = js.slice(previewIdx, previewBlockEnd + 7); // +7 for </div>

// Remove the preview block from its current position
js = js.slice(0, previewIdx) + js.slice(previewBlockEnd + 7);

// Step 2: Find where to insert it - right before the closing of chat-window (before `\n  `;`)
// Look for the pattern that closes the chat window template
const winCloseMarker = 'const container = document.getElementById(\'chatWindowsContainer\');';
const winCloseIdx = js.indexOf(winCloseMarker);
if (winCloseIdx === -1) {
  console.error('ERROR: Could not find chatWindowsContainer marker');
  process.exit(1);
}

// Go backwards from winCloseIdx to find the last `</div>\n    </div>\n  `; which closes chat-window
// Actually, let's find the exact spot to insert: after the closing </div> of chat-window__input-area
// and before the `\n  `;` that closes the template literal

// Find the closing of input-area: </div> after voicePreviewAudio
// Then we insert between the input-area end and the template literal closing
const inputAreaClose = 'style="display:none;"></audio>\n      </div>\n    </div>\n  `;';
const inputAreaEndIdx = js.indexOf(inputAreaClose, previewIdx > 500 ? previewIdx - 500 : 0);
if (inputAreaEndIdx === -1) {
  console.error('ERROR: Could not find input-area closing pattern');
  process.exit(1);
}

const insertPos = inputAreaEndIdx + inputAreaClose.length - 3; // before `\n  `;`

// Insert the preview block at the new position (as a direct child of .chat-window)
js = js.slice(0, insertPos) + '\n      ' + previewBlock + js.slice(insertPos);

fs.writeFileSync(jsPath, js, 'utf8');
console.log('✓ dashboard.js: moved chat-file-preview to direct child of .chat-window');

// ─── 2. Update CSS for full overlay ────────────────────────────────────────
const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

const cssComment = '/* File preview fills the chat window from input to header */';
const cssIdx = css.indexOf(cssComment);

if (cssIdx === -1) {
  console.error('ERROR: Could not find file preview CSS comment');
  process.exit(1);
}

// Find the start of the .chat-file-preview rules and the end (next comment or next top-level rule)
const ruleStart = css.indexOf('.chat-file-preview {', cssIdx);
const ruleEnd = css.indexOf('\n\n', ruleStart); // Find next blank line

if (ruleStart === -1) {
  console.error('ERROR: Could not find .chat-file-preview CSS rule');
  process.exit(1);
}

const oldRule = css.slice(cssIdx, ruleEnd !== -1 ? ruleEnd : cssIdx + 500);

const newCss = `/* File preview as full chat window overlay */
.chat-file-preview {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  border-radius: inherit;
  padding: 0;
  min-height: 80px;
  max-height: none;
  overflow: hidden;
  z-index: 50;
  animation: slideUpFade 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
}

.chat-file-preview.hidden {
  display: none;
}`;

css = css.slice(0, cssIdx) + newCss + css.slice(ruleEnd !== -1 ? ruleEnd : cssIdx + 500);

fs.writeFileSync(cssPath, css, 'utf8');
console.log('✓ style.css: updated chat-file-preview to full overlay');
console.log('✅ Done');
