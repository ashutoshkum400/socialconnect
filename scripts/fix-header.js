const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Header padding & gap
css = css.replace(
  /\.chat-window__header \{\n  display: flex;\n  align-items: center;\n  gap: var\(--space-sm\);\n  padding: var\(--space-sm\) var\(--space-md\);/,
  `.chat-window__header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;`
);

// 2. Avatar smaller
css = css.replace(
  /\.chat-window__header-avatar \{\n  width: 32px;\n  height: 32px;/,
  `.chat-window__header-avatar {
  width: 24px;
  height: 24px;`
);

// 3. Name font smaller
css = css.replace(
  /\.chat-window__header-name \{\n  font-weight: 700;\n  font-size: var\(--font-size-sm\);/,
  `.chat-window__header-name {
  font-weight: 700;
  font-size: 12px;`
);

// 4. Hide status line
css = css.replace(
  /\.chat-window__header-status \{\n  font-size: var\(--font-size-xs\);\n  opacity: 0\.85;\n}/,
  `.chat-window__header-status {
  display: none;`
);

// 5. Buttons smaller
css = css.replace(
  /\.chat-window__header-btn \{\n  width: 28px;\n  height: 28px;\n  border-radius: var\(--radius-full\);\n  background: rgba\(255,255,255,0\.15\);\n  backdrop-filter: blur\(4px\);\n  border: 1px solid rgba\(255,255,255,0\.1\);\n  color: white;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n  font-size: 0\.875rem;/,
  `.chat-window__header-btn {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: rgba(255,255,255,0.15);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.65rem;`
);

fs.writeFileSync(cssPath, css, 'utf8');
console.log('✅ Header CSS updated successfully!');
