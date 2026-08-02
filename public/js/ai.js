// SocialConnect AI Chat

SC.requireAuth();

const token = SC.getToken();
const storageKey = 'sc_ai_chats';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
let chats = [];
let currentChatId = null;
let isSending = false;

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadChats() {
  try {
    chats = JSON.parse(localStorage.getItem(storageKey) || '[]');
  } catch { chats = []; }
}

function saveChats() {
  localStorage.setItem(storageKey, JSON.stringify(chats));
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function toggleSidebar() {
  const s = document.getElementById('aiSidebar');
  const o = document.getElementById('sidebarOverlay');
  s.classList.toggle('open');
  o.style.display = s.classList.contains('open') ? 'block' : 'none';
}

function closeSidebar() {
  document.getElementById('aiSidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').style.display = 'none';
}

// ─── Chat Management ──────────────────────────────────────────────────────────

function newChat() {
  currentChatId = null;
  document.getElementById('welcomeScreen').classList.remove('hidden');
  document.getElementById('aiMessages').classList.add('hidden');
  document.getElementById('aiMessages').innerHTML = '';
  document.getElementById('aiInput').value = '';
  document.getElementById('aiInput').focus();
  updateSendBtn();
  renderSidebar();
  closeSidebar();
  if (window.innerWidth <= 768) closeSidebar();
}

function getOrCreateChat() {
  if (currentChatId) {
    const chat = chats.find(c => c.id === currentChatId);
    if (chat) return chat;
  }
  const chat = {
    id: Date.now().toString(),
    title: 'New Chat',
    messages: [],
    created: new Date().toISOString()
  };
  chats.unshift(chat);
  currentChatId = chat.id;
  saveChats();
  renderSidebar();
  return chat;
}

function switchChat(chatId) {
  const chat = chats.find(c => c.id === chatId);
  if (!chat) return;
  currentChatId = chatId;
  const container = document.getElementById('aiMessages');
  const welcome = document.getElementById('welcomeScreen');
  container.innerHTML = '';
  welcome.classList.add('hidden');
  container.classList.remove('hidden');

  chat.messages.forEach(msg => appendMessage(msg.role, msg.content, false));

  renderSidebar();
  closeSidebar();
  scrollToBottom();
}

function deleteChat(chatId, e) {
  e.stopPropagation();
  if (!confirm('Delete this chat?')) return;
  chats = chats.filter(c => c.id !== chatId);
  if (currentChatId === chatId) newChat();
  saveChats();
  renderSidebar();
}

function renderSidebar() {
  const list = document.getElementById('chatHistory');
  list.innerHTML = chats.map(c => `
    <div class="ai-chat-item ${c.id === currentChatId ? 'active' : ''}" onclick="switchChat('${c.id}')" style="display:flex;align-items:center;gap:6px;">
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(c.title)}</span>
      <span onclick="deleteChat('${c.id}', event)" style="cursor:pointer;opacity:.5;font-size:14px;flex-shrink:0;">✕</span>
    </div>
  `).join('');
}

// ─── Messages ─────────────────────────────────────────────────────────────────

function appendMessage(role, content, save = true) {
  const welcome = document.getElementById('welcomeScreen');
  const container = document.getElementById('aiMessages');
  welcome.classList.add('hidden');
  container.classList.remove('hidden');

  const isUser = role === 'user';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const div = document.createElement('div');
  div.className = `ai-msg ai-msg--${isUser ? 'user' : 'bot'}`;
  div.innerHTML = `
    <div class="ai-msg__avatar ai-msg__avatar--${isUser ? 'user' : 'bot'}">${isUser ? '👤' : '🤖'}</div>
    <div>
      <div class="ai-msg__bubble">${formatContent(content)}</div>
      <div class="ai-msg__time">${time}</div>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();

  if (save) {
    const chat = getOrCreateChat();
    chat.messages.push({ role, content, time: new Date().toISOString() });
    if (chat.messages.length === 1 && chat.title === 'New Chat') {
      chat.title = content.slice(0, 40) + (content.length > 40 ? '...' : '');
    }
    saveChats();
    renderSidebar();
  }
}

function formatContent(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function showTyping() {
  const container = document.getElementById('aiMessages');
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg--bot';
  div.id = 'typingIndicator';
  div.innerHTML = `
    <div class="ai-msg__avatar ai-msg__avatar--bot">🤖</div>
    <div>
      <div class="ai-msg__bubble">
        <div class="ai-typing"><span class="ai-typing__dot"></span><span class="ai-typing__dot"></span><span class="ai-typing__dot"></span></div>
      </div>
    </div>
  `;
  container.appendChild(div);
  scrollToBottom();
}

function removeTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    const container = document.getElementById('aiMessages');
    container.scrollTop = container.scrollHeight;
  });
}

// ─── Send ─────────────────────────────────────────────────────────────────────

async function sendMessage() {
  if (isSending) return;
  const input = document.getElementById('aiInput');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  updateSendBtn();
  autoResize(input);

  appendMessage('user', text);
  isSending = true;
  showTyping();

  const chat = getOrCreateChat();
  const history = chat.messages.map(m => ({ role: m.role, content: m.content }));
  const customKey = getCustomApiKey();
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ message: text, history, apiKey: customKey || undefined })
    });
    if (res.status === 401) { SC.logout(); return; }
    const data = await res.json();
    removeTyping();
    if (!res.ok) {
      appendMessage('bot', '⚠️ ' + (data.error || 'AI service unavailable. Check your API key in settings.'));
    } else {
      appendMessage('bot', data.response || 'No response received.');
    }
  } catch (e) {
    removeTyping();
    appendMessage('bot', '⚠️ Network error. Please check your connection and try again.');
  }
  isSending = false;
}

function sendSuggestion(text) {
  document.getElementById('aiInput').value = text;
  updateSendBtn();
  sendMessage();
}

function handleInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  updateSendBtn();
}

function updateSendBtn() {
  const btn = document.getElementById('aiSendBtn');
  const val = document.getElementById('aiInput').value.trim();
  btn.disabled = !val || isSending;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

const API_KEY_STORAGE = 'sc_ai_api_key';

function getCustomApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

function openAiSettings() {
  document.getElementById('apiKeyInput').value = getCustomApiKey();
  document.getElementById('apiKeyStatus').textContent = '';
  document.getElementById('aiSettingsOverlay').classList.remove('hidden');
  closeSidebar();
}

function closeAiSettings() {
  document.getElementById('aiSettingsOverlay').classList.add('hidden');
}

function saveAiSettings() {
  const key = document.getElementById('apiKeyInput').value.trim();
  const status = document.getElementById('apiKeyStatus');
  
  // Validate key format — support Groq (gsk_), OpenAI (sk-), OpenRouter (sk-or-v1-), and Gemini (AIza)
  const isValidFormat = !key || key.startsWith('gsk_') || key.startsWith('sk-') || key.startsWith('AIza');
  if (!isValidFormat) {
    status.textContent = '❌ Invalid key format. Use gsk_... (Groq), sk-... (OpenAI), sk-or-v1-... (OpenRouter), or AIza... (Gemini)';
    status.className = 'ai-modal__status ai-modal__status--err';
    return;
  }
  
  if (key) {
    localStorage.setItem(API_KEY_STORAGE, key);
    status.textContent = '✅ Custom API key saved! Using your own key.';
    status.className = 'ai-modal__status ai-modal__status--ok';
  } else {
    localStorage.removeItem(API_KEY_STORAGE);
    status.textContent = '✅ Cleared custom key. Using fallback responses.';
    status.className = 'ai-modal__status ai-modal__status--ok';
  }
  setTimeout(closeAiSettings, 1200);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadChats();
renderSidebar();
if (chats.length > 0) {
  switchChat(chats[0].id);
} else {
  document.getElementById('aiInput').focus();
}
