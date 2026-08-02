const fs = require('fs');

// ─── 1. Fix dashboard.js: move .chat-file-preview out of .chat-window__input-area ───
let dash = fs.readFileSync('public/js/dashboard.js', 'utf8');

// We need to find the file preview block inside chat-window__input-area and move it outside.
// In the template, the structure is:
//   ...</div> <!-- end .chat-window__input-mode -->
//   <div class="chat-file-preview hidden" id="filePreview_${userId}">
//     ...
//   </div>
//   <div class="voice-recording-overlay hidden" id="recordingOverlay_${userId}">
//
// We need to move it to just before the closing </div> of chat-window__input-area
// which is right after voice-preview-overlay block.

// Find the file preview template block
const previewStart = '<div class="chat-file-preview hidden" id="filePreview_${userId}">';
const previewEnd = '</div>\n      <div class="voice-recording-overlay hidden" id="recordingOverlay_${userId}">';

// Find all occurrences
let idx = 0;
let found = false;
const result = [];

while (idx < dash.length) {
  const startIdx = dash.indexOf(previewStart, idx);
  if (startIdx === -1) {
    result.push(dash.slice(idx));
    break;
  }
  
  // Find the matching closing </div> for the file preview
  // We need to find the end of the file preview block
  const afterStart = startIdx + previewStart.length;
  
  // Find the closing of the file preview div's children
  // The block is:
  // <div class="chat-file-preview hidden" ...>
  //   <div class="chat-file-preview__header">...</div>
  //   <div class="chat-file-preview__list" ...></div>
  //   <div class="chat-file-preview__footer">...</div>
  // </div>
  // <div class="voice-recording-overlay ...">
  
  // Find the voice-recording-overlay start after the file preview
  const voiceStart = dash.indexOf(previewEnd, startIdx);
  if (voiceStart === -1) {
    result.push(dash.slice(idx));
    break;
  }
  
  // The file preview block ends at voiceStart (which is the newline before voice-recording-overlay)
  const previewBlockEnd = voiceStart;
  
  // The full file preview block including the closing </div> and newline
  // Actually previewEnd starts with '</div>\n' which is the closing of .chat-file-preview
  
  // Now find the closing </div> of .chat-window__input-area
  // After voice-preview-overlay block ends
  const inputAreaClose = '</div>\n    </div>\n  `;';  // This is the end of chat-window__input-area
  
  const afterVoice = afterCloseOfVoice(dash, voiceStart);
  
  // The input-area close tag appears after voice-preview-overlay
  // Let's find it
  const inputAreaCloseIdx = dash.indexOf('</div>\n    </div>\n  `;', voiceStart);
  
  result.push(dash.slice(idx, startIdx)); // Content before file preview
  // Skip the file preview block
  idx = previewBlockEnd + previewEnd.length;
  
  // Add the rest
  remaining = dash.slice(idx);
  
  // Now we need to insert the file preview block AFTER the input-area closing
  // Find where to insert: after the </div> of .chat-window__input-area
  
  // Actually, let me take a different approach. Let me just modify the string directly.
}

// This is getting complicated with nested divs. Let me use a simpler approach:
// Just replace the entire chat-window__input-area content by finding the exact strings.

// Simpler approach: find the file preview block in the template and move it
// after the input-area closing div.

// First, let's find the complete file preview block including its children
const fpStartFull = '<div class="chat-file-preview hidden" id="filePreview_${userId}">\n';
// The file preview block ends right before voice-recording-overlay
const fpEndMarker = '\n      <div class="voice-recording-overlay hidden"';

let s1 = dash.indexOf(fpStartFull);
if (s1 === -1) {
  console.log('ERROR: Could not find file preview start in dashboard.js');
  process.exit(1);
}

let e1 = dash.indexOf(fpEndMarker, s1);
if (e1 === -1) {
  console.log('ERROR: Could not find voice-recording-overlay after file preview');
  process.exit(1);
}

// The file preview block including its trailing newline
const fpBlock = dash.slice(s1, e1 + 1); // include the newline

// Move it after the input-area closing </div>
// The input-area closing is: </div>\n    </div>\n  `;
// Which is after the voice-preview-overlay block
const inputAreaCloser = '</div>\n    </div>\n  `;\n\n  const container';
let closerIdx = dash.indexOf(inputAreaCloser);
if (closerIdx === -1) {
  console.log('ERROR: Could not find input-area closer in dashboard.js');
  process.exit(1);
}

// Remove the file preview block from its current position
let modified = dash.slice(0, s1) + dash.slice(e1 + 1);

// Adjust: the closerIdx might have shifted since we removed content
if (closerIdx > s1) {
  closerIdx -= fpBlock.length;
}

// Insert the file preview block after the input-area closer
const insertPos = closerIdx + inputAreaCloser.length;
modified = modified.slice(0, insertPos) + '\n      ' + fpBlock.trim() + '\n' + modified.slice(insertPos);

fs.writeFileSync('public/js/dashboard.js', modified, 'utf8');
console.log('✅ dashboard.js: moved file preview out of input area');

// ─── 2. Fix style.css: update chat-file-preview to cover full window ───
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
  console.log('ERROR: Could not find end of file preview CSS in style.css');
  process.exit(1);
}

cssEndIdx += oldEnd.length;

const beforeCss = css.slice(0, cssIdx);
const afterCss = css.slice(cssEndIdx);
css = beforeCss + newCss + '\n\n' + afterCss;

// Also ensure .chat-window > * doesn't override z-index for the preview
// The rule is: .chat-window > * { position: relative; z-index: 1; }
// Our .chat-file-preview is a direct child with position:absolute and z-index:100, so it's fine.

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('✅ style.css: updated file preview to overlay entire chat window');
console.log('✅ Done!');
