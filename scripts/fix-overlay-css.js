const fs = require('fs');
let css = fs.readFileSync('public/css/style.css', 'utf8');

const start = css.indexOf('.chat-file-preview {');
const end = css.indexOf('.chat-file-preview.hidden', start);
if (start === -1 || end === -1) {
  console.error('Could not find CSS blocks');
  process.exit(1);
}

const oldBlock = css.slice(start, end);
console.log('Old CSS block:', oldBlock.slice(0, 100) + '...');

const newBlock = `.chat-file-preview {
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
}
`;

css = css.slice(0, start) + newBlock + css.slice(end);

fs.writeFileSync('public/css/style.css', css, 'utf8');
console.log('✅ CSS updated successfully');
