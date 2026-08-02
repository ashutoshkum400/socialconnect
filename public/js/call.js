'use strict';

const ICONS = {
  phone: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  phoneOff: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>',
  video: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
  videoOff: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  mic: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="19" x2="16" y2="23"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>',
  endCall: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  phoneIncoming: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 2 16 8 22 8"/><line x1="23" y1="1" x2="16" y2="8"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
};

const callState = {
  active: false, callType: null, peerConnection: null,
  localStream: null, remoteStream: null,
  peerId: null, peerName: '', peerAvatar: '',
  chatWinId: null, isCaller: false,
  startTime: null, timerInterval: null,
  isMuted: false, isVideoOff: false,
  savedMessagesHTML: null, savedHeaderHTML: null,
  audioContext: null, callTimeout: null,
  pendingOffer: null,
};

const groupCallState = {
  active: false,
  callId: null,
  callType: 'audio',
  localStream: null,
  peerConnections: {}, // userId -> RTCPeerConnection
  remoteStreams: {},   // userId -> MediaStream
  participants: {},    // userId -> { name, avatar, muted, videoOff }
  participantOrder: [],
  activeSpeakerId: null,
  isMuted: false,
  isVideoOff: false,
  audioContext: null,
  analyserNode: null,
  speakerCheckInterval: null,
  startTime: null,
  timerInterval: null,
  chatWinId: null,
  savedMessagesHTML: null,
  savedHeaderHTML: null,
  isCreator: false,
};

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const RINGTONE_PRESETS = {
  'classic-beep': {
    label: 'Classic Beep',
    notes: [
      { freq: 440, start: 0, dur: 0.5, type: 'sine', gain: 0.3 },
      { freq: 480, start: 0.6, dur: 0.5, type: 'sine', gain: 0.3 },
    ],
    loop: true,
    loopGap: 0.3,
  },
  'sweet-desire': {
    label: 'Sweet Desire',
    notes: [
      { freq: 523.25, start: 0.00, dur: 0.30, type: 'sine', gain: 0.25 },
      { freq: 659.25, start: 0.25, dur: 0.30, type: 'sine', gain: 0.25 },
      { freq: 783.99, start: 0.50, dur: 0.30, type: 'sine', gain: 0.25 },
      { freq: 1046.50, start: 0.75, dur: 0.45, type: 'sine', gain: 0.20 },
      { freq: 783.99, start: 1.10, dur: 0.25, type: 'triangle', gain: 0.12 },
      { freq: 659.25, start: 1.30, dur: 0.35, type: 'triangle', gain: 0.10 },
    ],
    loop: true,
    loopGap: 0.8,
  },
  'soft-chime': {
    label: 'Soft Chime',
    notes: [
      { freq: 523.25, start: 0.00, dur: 0.60, type: 'triangle', gain: 0.18 },
      { freq: 659.25, start: 0.00, dur: 0.60, type: 'triangle', gain: 0.15 },
      { freq: 783.99, start: 0.00, dur: 0.60, type: 'triangle', gain: 0.12 },
      { freq: 783.99, start: 0.70, dur: 0.40, type: 'sine', gain: 0.08 },
    ],
    loop: true,
    loopGap: 0.5,
  },
};

function scheduleNote(audioCtx, note, baseTime, destination) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = note.type || 'sine';
  osc.frequency.setValueAtTime(note.freq, baseTime + note.start);
  gain.gain.setValueAtTime(0, baseTime + note.start);
  gain.gain.linearRampToValueAtTime(note.gain || 0.3, baseTime + note.start + 0.03);
  gain.gain.setValueAtTime(note.gain || 0.3, baseTime + note.start + note.dur - 0.08);
  gain.gain.exponentialRampToValueAtTime(0.001, baseTime + note.start + note.dur);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(baseTime + note.start);
  osc.stop(baseTime + note.start + note.dur);
}

function startRingtone(type) {
  stopRingtone();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  callState.audioContext = audioCtx;

  const presetName = getRingtonePreference();
  const preset = RINGTONE_PRESETS[presetName] || RINGTONE_PRESETS['classic-beep'];
  const isIncoming = type === 'incoming';
  const speed = isIncoming ? 1.0 : 1.2;

  function scheduleSequence() {
    if (!callState.audioContext || callState.audioContext !== audioCtx) return;
    const now = audioCtx.currentTime;
    let maxEnd = 0;
    preset.notes.forEach(n => {
      scheduleNote(audioCtx, {
        ...n,
        start: n.start / speed,
        dur: n.dur / speed,
      }, now, audioCtx.destination);
      const end = n.start / speed + n.dur / speed;
      if (end > maxEnd) maxEnd = end;
    });
    const totalGap = (preset.loopGap || 0.5) / speed;
    const totalDuration = maxEnd + totalGap;
    if (preset.loop) {
      callState._ringtoneTimer = setTimeout(scheduleSequence, totalDuration * 1000);
    }
  }
  scheduleSequence();
}

const RINGTONE_STORAGE_KEY = 'sc_ringtone_preference';

function getRingtonePreference() {
  return localStorage.getItem(RINGTONE_STORAGE_KEY) || 'classic-beep';
}

function setRingtonePreference(presetName) {
  localStorage.setItem(RINGTONE_STORAGE_KEY, presetName);
}

function showRingtoneSettingsModal() {
  const existing = document.getElementById('ringtoneSettingsModal');
  if (existing) { existing.remove(); return; }

  const current = getRingtonePreference();
  const modal = document.createElement('div');
  modal.id = 'ringtoneSettingsModal';
  modal.className = 'group-call__add-modal-overlay';
  modal.innerHTML = `
    <div class="ringtone-settings__modal">
      <div class="group-call__add-modal-header">
        <span>🔔 Ringtone Settings</span>
        <button onclick="document.getElementById('ringtoneSettingsModal')?.remove()">✕</button>
      </div>
      <div class="ringtone-settings__body">
        <div class="ringtone-settings__desc">Choose your call ringtone (applies to both 1-to-1 and group calls):</div>
        ${Object.entries(RINGTONE_PRESETS).map(([key, p]) => `
          <label class="ringtone-settings__option ${current === key ? 'selected' : ''}" data-preset="${key}">
            <input type="radio" name="ringtone" value="${key}" ${current === key ? 'checked' : ''} onchange="selectRingtonePreset('${key}')">
            <div class="ringtone-settings__option-info">
              <span class="ringtone-settings__option-label">${p.label}</span>
            </div>
            <button class="btn btn--outline-secondary btn--xs" onclick="event.stopPropagation();previewRingtonePreset('${key}')" title="Preview">▶</button>
          </label>
        `).join('')}
      </div>
      <div class="ringtone-settings__footer">
        <button class="btn btn--primary btn--sm" onclick="document.getElementById('ringtoneSettingsModal')?.remove()">Done</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('keydown', function(e) { if (e.key === 'Escape') modal.remove(); });
}

function selectRingtonePreset(presetName) {
  setRingtonePreference(presetName);
  document.querySelectorAll('.ringtone-settings__option').forEach(function(opt) {
    opt.classList.toggle('selected', opt.dataset.preset === presetName);
  });
}

function previewRingtonePreset(presetName) {
  stopRingtone();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const preset = RINGTONE_PRESETS[presetName];
  if (!preset) return;
  const now = audioCtx.currentTime;
  preset.notes.forEach(function(n) {
    scheduleNote(audioCtx, n, now, audioCtx.destination);
  });
  setTimeout(function() { try { audioCtx.close(); } catch(e) {} }, 3000);
}

function stopRingtone() {
  if (callState._ringtoneTimer) { clearTimeout(callState._ringtoneTimer); callState._ringtoneTimer = null; }
  if (callState.audioContext) { callState.audioContext.close(); callState.audioContext = null; }
}

function startCallTimer() {
  callState.startTime = Date.now();
  callState.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callState.startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    document.querySelectorAll('.chat-call__timer').forEach(e => e.textContent = `${mins}:${secs}`);
  }, 1000);
}

function stopCallTimer() {
  clearInterval(callState.timerInterval);
  callState.timerInterval = null;
  callState.startTime = null;
}

function getChatWindow(userId) {
  return document.querySelector(`.chat-window[data-chat-user-id="${userId}"]`);
}

function getChatWindowElements(userId) {
  const win = getChatWindow(userId);
  if (!win) return null;
  return { win, header: win.querySelector('.chat-window__header'), messages: win.querySelector('.chat-window__messages'), inputArea: win.querySelector('.chat-window__input-area') };
}

function restoreChatFromCall() {
  const winId = callState.chatWinId;
  if (!winId) return;
  const el = getChatWindowElements(winId);
  if (el) {
    if (callState.savedMessagesHTML !== null) { el.messages.innerHTML = callState.savedMessagesHTML; callState.savedMessagesHTML = null; }
    if (callState.savedHeaderHTML !== null) { el.header.innerHTML = callState.savedHeaderHTML; callState.savedHeaderHTML = null; }
  }
  callState.chatWinId = null;
}

function showOutgoingCallUI(userId, userName, userAvatar, callType) {
  const el = getChatWindowElements(userId);
  if (!el) return;
  callState.chatWinId = userId;
  callState.savedMessagesHTML = el.messages.innerHTML;
  callState.savedHeaderHTML = el.header.innerHTML;

  el.messages.innerHTML = `
    <div class="chat-call__container chat-call__container--outgoing">
      <div class="chat-call__outgoing-bg"></div>
      <div class="chat-call__outgoing-content">
        <div class="chat-call__avatar-ring">
          <img class="chat-call__avatar chat-call__avatar--lg" src="${userAvatar}" alt="${userName}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=1877f2&color=fff&size=128'">
        </div>
        <div class="chat-call__name">${userName}</div>
        <div class="chat-call__status">
          <span class="chat-call__status-text">Calling</span>
          <span class="chat-call__status-dots"><span>.</span><span>.</span><span>.</span></span>
        </div>
      </div>
      <div class="chat-call__controls chat-call__controls--outgoing">
        <button class="chat-call__ctrl-btn" id="callMuteBtn" onclick="toggleMute()" title="Mute">
          ${ICONS.mic}<span>Mute</span>
        </button>
        ${callType === 'audio' ? `
        <button class="chat-call__ctrl-btn" id="callSwitchVideoBtn" onclick="switchToVideo()" title="Switch to Video">
          ${ICONS.video}<span>Video</span>
        </button>` : ''}
        <button class="chat-call__ctrl-btn chat-call__ctrl-btn--end" onclick="endCall()" title="End Call">
          ${ICONS.endCall}<span>End</span>
        </button>
      </div>
    </div>`;

  el.header.innerHTML = `
    <div class="chat-call__header-info">
      <span class="chat-call__header-label">📞 Outgoing ${callType} call</span>
      <span class="chat-call__header-name">${userName}</span>
    </div>
    <div class="chat-call__header-actions">
      <button class="chat-window__header-btn" onclick="closeChatWindow('${userId}')">✕</button>
    </div>`;

  el.inputArea.innerHTML = `
    <div class="chat-call__incoming-input">
      <span>🔔 Ringing...</span>
    </div>`;
}

function showIncomingCallUI(name, avatar, callType) {
  const el = getChatWindowElements(callState.peerId);
  if (!el) {
    const overlay = document.createElement('div');
    overlay.id = 'callOverlay';
    overlay.className = 'call-overlay call-overlay--incoming-full';
    overlay.innerHTML = `
      <div class="call-overlay__incoming-bg"></div>
      <div class="call-overlay__incoming-content">
        <div class="call-overlay__ring-pulse">
          <img class="call-overlay__avatar call-overlay__avatar--lg" src="${avatar}" alt="${name}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1877f2&color=fff&size=128'">
        </div>
        <div class="call-overlay__name">${name}</div>
        <div class="call-overlay__status">Incoming ${callType} call</div>
        <div class="call-overlay__actions">
          <div class="call-overlay__action-group">
            <button class="call-btn call-btn--accept" onclick="acceptCall()" title="Accept">${callType === 'video' ? ICONS.video : ICONS.phone}</button>
            <span>Accept</span>
          </div>
          <div class="call-overlay__action-group">
            <button class="call-btn call-btn--reject" onclick="rejectCall()" title="Reject">${ICONS.phoneOff}</button>
            <span>Decline</span>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    startRingtone('incoming');
    callState.callTimeout = setTimeout(() => { if (!callState.active) rejectCall(); }, 50000);
    return;
  }

  callState.chatWinId = callState.peerId;
  callState.savedMessagesHTML = el.messages.innerHTML;
  callState.savedHeaderHTML = el.header.innerHTML;

  el.messages.innerHTML = `
    <div class="chat-call__container chat-call__container--incoming">
      <div class="chat-call__incoming-bg"></div>
      <div class="chat-call__incoming-content">
        <div class="chat-call__avatar-ring ${callType === 'audio' ? 'chat-call__avatar-ring--slow' : ''}">
          <img class="chat-call__avatar chat-call__avatar--lg" src="${avatar}" alt="${name}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1877f2&color=fff&size=128'">
        </div>
        <div class="chat-call__name">${name}</div>
        <div class="chat-call__status">Incoming ${callType} call</div>
      </div>
      <div class="chat-call__incoming-actions">
        <div class="chat-call__action-btn-group">
          <button class="chat-call__action-btn chat-call__action-btn--accept" onclick="acceptCall()" title="Accept">
            ${callType === 'video' ? ICONS.video : ICONS.phone}
          </button>
          <span>Accept</span>
        </div>
        <div class="chat-call__action-btn-group">
          <button class="chat-call__action-btn chat-call__action-btn--reject" onclick="rejectCall()" title="Reject">
            ${ICONS.phoneOff}
          </button>
          <span>Decline</span>
        </div>
      </div>
    </div>`;

  el.header.innerHTML = `
    <div class="chat-call__header-info">
      <span class="chat-call__header-label">📞 Incoming Call</span>
      <span class="chat-call__header-name">${name}</span>
    </div>
    <div class="chat-call__header-actions">
      <button class="chat-window__header-btn" onclick="closeChatWindow('${callState.peerId}')">✕</button>
    </div>`;

  el.inputArea.innerHTML = `
    <div class="chat-call__incoming-input">
      <span>🔔 Incoming ${callType} call...</span>
    </div>`;

  startRingtone('incoming');
  callState.callTimeout = setTimeout(() => { if (!callState.active) rejectCall(); }, 50000);
}

function showActiveCallUI() {
  const el = getChatWindowElements(callState.chatWinId);
  if (!el) return;

  el.header.innerHTML = `
    <div class="chat-call__header-info">
      <span class="chat-call__header-label">${callState.callType === 'video' ? '📷' : '📞'} On Call</span>
      <span class="chat-call__header-name">${callState.peerName}</span>
      <span class="chat-call__timer">00:00</span>
    </div>
    <div class="chat-call__header-actions">
      <button class="chat-window__header-btn" onclick="closeChatWindow('${callState.chatWinId}')">✕</button>
    </div>`;

  if (callState.callType === 'video') {
    el.messages.innerHTML = `
      <div class="chat-call__video-container">
        <video id="remoteVideo" class="chat-call__remote-video" autoplay playsinline></video>
        <video id="localVideo" class="chat-call__local-video" autoplay playsinline muted></video>
      </div>`;
  } else {
    el.messages.innerHTML = `
      <div class="chat-call__container chat-call__container--connected">
        <div class="chat-call__avatar-ring chat-call__avatar-ring--connected">
          <img class="chat-call__avatar chat-call__avatar--lg" src="${callState.peerAvatar}" alt="${callState.peerName}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(callState.peerName)}&background=1877f2&color=fff&size=128'">
        </div>
        <div class="chat-call__name">${callState.peerName}</div>
        <div class="chat-call__status">Connected</div>
      </div>`;
  }

  el.inputArea.innerHTML = `
    <div class="chat-call__controls">
      <button class="chat-call__ctrl-btn" id="callMuteBtn" onclick="toggleMute()" title="Mute">
        ${ICONS.mic}<span>Mute</span>
      </button>
      ${callState.callType === 'video' ? `
      <button class="chat-call__ctrl-btn" id="callVideoBtn" onclick="toggleVideo()" title="Video">
        ${ICONS.video}<span>Video</span>
      </button>` : `
      <button class="chat-call__ctrl-btn" id="callSpeakerBtn" onclick="toggleSpeaker()" title="Speaker">
        ${ICONS.speaker}<span>Speaker</span>
      </button>`}
      <button class="chat-call__ctrl-btn chat-call__ctrl-btn--end" onclick="endCall()" title="End Call">
        ${ICONS.endCall}<span>End</span>
      </button>
    </div>`;

  const remoteVideo = document.getElementById('remoteVideo');
  const localVideo = document.getElementById('localVideo');
  if (remoteVideo && callState.remoteStream) remoteVideo.srcObject = callState.remoteStream;
  if (localVideo && callState.localStream) localVideo.srcObject = callState.localStream;
}

async function startCall(userId, userName, userAvatar, callType) {
  if (callState.active) { SC.showError('You are already in a call'); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' });
    callState.active = true;
    callState.isCaller = true;
    callState.callType = callType;
    callState.peerId = userId;
    callState.peerName = userName;
    callState.peerAvatar = userAvatar;
    callState.localStream = stream;
    callState.isMuted = false;
    callState.isVideoOff = false;

    showOutgoingCallUI(userId, userName, userAvatar, callType);

    const pc = new RTCPeerConnection(RTC_CONFIG);
    callState.peerConnection = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      callState.remoteStream = event.streams[0];
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) remoteVideo.srcObject = event.streams[0];
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit('webrtc_ice_candidate', { toUserId: callState.peerId, candidate: event.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        if (callState.active) { SC.showInfo('Call disconnected'); endCallCleanup(); }
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc_offer', { toUserId: userId, offer });
    socket.emit('call_user', { toUserId: userId, callType });

    startRingtone('outgoing');
    callState.callTimeout = setTimeout(() => {
      if (callState.active && !callState.remoteStream) {
        SC.showError('Call not answered');
        endCallCleanup();
      }
    }, 50000);
  } catch (err) {
    console.error('startCall error:', err);
    SC.showError('Could not start call: ' + (err.message || 'Unknown error'));
    endCallCleanup();
  }
}

async function acceptCall() {
  if (!callState.peerId) return;
  if (callState.callTimeout) { clearTimeout(callState.callTimeout); callState.callTimeout = null; }
  stopRingtone();
  document.getElementById('callOverlay')?.remove();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callState.callType === 'video' });
    callState.active = true;
    callState.localStream = stream;
    callState.isMuted = false;
    callState.isVideoOff = false;

    const el = getChatWindowElements(callState.peerId);
    if (el) {
      callState.chatWinId = callState.peerId;
      if (callState.savedMessagesHTML === null) callState.savedMessagesHTML = el.messages.innerHTML;
      if (callState.savedHeaderHTML === null) callState.savedHeaderHTML = el.header.innerHTML;
    } else if (!callState.chatWinId) {
      const wins = document.querySelectorAll('.chat-window');
      if (wins.length > 0) {
        callState.chatWinId = callState.peerId;
        callState.savedMessagesHTML = wins[0].querySelector('.chat-window__messages')?.innerHTML || '';
        callState.savedHeaderHTML = wins[0].querySelector('.chat-window__header')?.innerHTML || '';
      }
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    callState.peerConnection = pc;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      callState.remoteStream = event.streams[0];
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) remoteVideo.srcObject = event.streams[0];
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit('webrtc_ice_candidate', { toUserId: callState.peerId, candidate: event.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        if (callState.active) { SC.showInfo('Call disconnected'); endCallCleanup(); }
      }
    };

    socket.emit('call_accepted', { toUserId: callState.peerId });

    // Process any offer that arrived before user accepted
    if (callState.pendingOffer) {
      try {
        await callState.peerConnection.setRemoteDescription(new RTCSessionDescription(callState.pendingOffer));
        callState.pendingOffer = null;
        const answer = await callState.peerConnection.createAnswer();
        await callState.peerConnection.setLocalDescription(answer);
        socket.emit('webrtc_answer', { toUserId: callState.peerId, answer });
        showActiveCallUI();
        startCallTimer();
      } catch (err) {
        console.error('Error processing pending offer:', err);
        endCallCleanup();
      }
    }
  } catch (err) {
    console.error('acceptCall error:', err);
    SC.showError('Could not accept call: ' + (err.message || 'Unknown error'));
    rejectCall();
  }
}

function rejectCall() {
  if (callState.callTimeout) { clearTimeout(callState.callTimeout); callState.callTimeout = null; }
  if (callState.peerId) socket.emit('call_rejected', { toUserId: callState.peerId });
  stopRingtone();
  document.getElementById('callOverlay')?.remove();
  restoreChatFromCall();
  callState.active = false;
  callState.peerId = null;
  callState.callType = null;
  callState.pendingOffer = null;
}

function endCall() {
  if (callState.callTimeout) { clearTimeout(callState.callTimeout); callState.callTimeout = null; }
  if (callState.peerId) socket.emit('call_end', { toUserId: callState.peerId });
  endCallCleanup();
}

function toggleMute() {
  callState.isMuted = !callState.isMuted;
  if (callState.localStream) { const t = callState.localStream.getAudioTracks()[0]; if (t) t.enabled = !callState.isMuted; }
  const btn = document.getElementById('callMuteBtn');
  if (btn) {
    btn.innerHTML = callState.isMuted ? `${ICONS.micOff}<span>Unmute</span>` : `${ICONS.mic}<span>Mute</span>`;
    btn.classList.toggle('chat-call__ctrl-btn--active', callState.isMuted);
  }
}

function toggleVideo() {
  if (callState.callType !== 'video') return;
  callState.isVideoOff = !callState.isVideoOff;
  if (callState.localStream) { const t = callState.localStream.getVideoTracks()[0]; if (t) t.enabled = !callState.isVideoOff; }
  const btn = document.getElementById('callVideoBtn');
  if (btn) {
    btn.innerHTML = callState.isVideoOff ? `${ICONS.videoOff}<span>Video Off</span>` : `${ICONS.video}<span>Video</span>`;
    btn.classList.toggle('chat-call__ctrl-btn--active', callState.isVideoOff);
  }
}

function toggleSpeaker() {
  const btn = document.getElementById('callSpeakerBtn');
  if (btn) {
    btn.classList.toggle('chat-call__ctrl-btn--active');
    const span = btn.querySelector('span');
    if (span) span.textContent = btn.classList.contains('chat-call__ctrl-btn--active') ? 'Earpiece' : 'Speaker';
  }
}

function switchToVideo() {
  SC.showInfo('Switching to video...');
  if (callState.localStream) {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(newStream => {
      const oldTracks = callState.localStream.getTracks();
      oldTracks.forEach(t => t.stop());
      callState.localStream = newStream;
      const sender = callState.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
      const videoTrack = newStream.getVideoTracks()[0];
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      } else if (videoTrack) {
        callState.peerConnection?.addTrack(videoTrack, newStream);
      }
      callState.callType = 'video';
      showActiveCallUI();
      const localVideo = document.getElementById('localVideo');
      if (localVideo) localVideo.srcObject = newStream;
    }).catch(err => SC.showError('Could not access camera'));
  }
}

function endCallCleanup() {
  if (callState.callTimeout) { clearTimeout(callState.callTimeout); callState.callTimeout = null; }
  stopCallTimer();
  stopRingtone();
  if (callState.peerConnection) { callState.peerConnection.close(); callState.peerConnection = null; }
  if (callState.localStream) { callState.localStream.getTracks().forEach(t => t.stop()); callState.localStream = null; }
  callState.remoteStream = null;
  callState.active = false;
  callState.isCaller = false;
  callState.peerId = null;
  callState.peerName = '';
  callState.peerAvatar = '';
  callState.callType = null;
  callState.isMuted = false;
  callState.isVideoOff = false;
  callState.pendingOffer = null;
  document.getElementById('callOverlay')?.remove();
  restoreChatFromCall();
}

// ═══════════════════════════════════════════════════════════════════
// GROUP CALL — State & Multi-Peer WebRTC
// ═══════════════════════════════════════════════════════════════════

function getGroupCallContainer() {
  if (!groupCallState.chatWinId) return null;
  const win = document.querySelector(`.chat-window[data-chat-user-id="${groupCallState.chatWinId}"]`);
  if (!win) return null;
  return {
    win,
    header: win.querySelector('.chat-window__header'),
    messages: win.querySelector('.chat-window__messages'),
    inputArea: win.querySelector('.chat-window__input-area'),
  };
}

function saveGroupCallChatState() {
  const el = getGroupCallContainer();
  if (!el) return;
  groupCallState.savedMessagesHTML = el.messages.innerHTML;
  groupCallState.savedHeaderHTML = el.header.innerHTML;
}

function restoreGroupCallChatState() {
  const winId = groupCallState.chatWinId;
  if (!winId) return;
  const el = getGroupCallContainer();
  if (el) {
    if (groupCallState.savedMessagesHTML !== null) {
      el.messages.innerHTML = groupCallState.savedMessagesHTML;
      groupCallState.savedMessagesHTML = null;
    }
    if (groupCallState.savedHeaderHTML !== null) {
      el.header.innerHTML = groupCallState.savedHeaderHTML;
      groupCallState.savedHeaderHTML = null;
    }
  }
  groupCallState.chatWinId = null;
}

function startGroupCallTimer() {
  groupCallState.startTime = Date.now();
  groupCallState.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - groupCallState.startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    document.querySelectorAll('.group-call__timer').forEach(e => e.textContent = `${mins}:${secs}`);
  }, 1000);
}

function stopGroupCallTimer() {
  clearInterval(groupCallState.timerInterval);
  groupCallState.timerInterval = null;
  groupCallState.startTime = null;
}

function renderGroupCallParticipants() {
  const container = document.getElementById('groupCallParticipants');
  if (!container) return;

  const userIds = groupCallState.participantOrder;
  if (userIds.length === 0) return;

  const isSpotlight = userIds.length > 2;
  const spotlightId = groupCallState.activeSpeakerId || userIds[0];
  const spotlight = groupCallState.participants[spotlightId];

  let html = '';

  // Speaker spotlight (largest view)
  if (isSpotlight && spotlight) {
    html += `
      <div class="group-call__spotlight" id="groupCallSpotlight_${spotlightId}">
        <video class="group-call__spotlight-video" id="groupRemoteVideo_${spotlightId}" autoplay playsinline ${spotlightId === currentUser?.id ? 'muted' : ''}></video>
        <div class="group-call__spotlight-fallback" id="groupFallback_${spotlightId}">
          <div class="group-call__avatar-lg">${(spotlight.name || '?')[0].toUpperCase()}</div>
        </div>
        <div class="group-call__participant-name">${escapeHtml(spotlight.name || 'Unknown')}</div>
        <div class="group-call__participant-status">
          ${spotlight.muted ? '🔇 Muted' : ''}
        </div>
      </div>`;
  }

  // Participant thumbnails
  const tiles = userIds.map((uid, i) => {
    const p = groupCallState.participants[uid];
    if (!p) return '';
    const isSpotlighted = isSpotlight && uid === spotlightId;
    const showVideo = p.videoStream && !p.videoOff;

    return `
      <div class="group-call__tile ${isSpotlighted ? 'group-call__tile--hidden' : ''}" id="groupCallTile_${uid}">
        ${showVideo ? `<video class="group-call__tile-video" id="groupRemoteVideo_${uid}" autoplay playsinline ${uid === currentUser?.id ? 'muted' : ''}></video>` : ''}
        <div class="group-call__tile-fallback" id="groupTileFallback_${uid}" style="${showVideo ? 'display:none' : ''}">
          <div class="group-call__avatar-sm">${(p.name || '?')[0].toUpperCase()}</div>
        </div>
        <div class="group-call__tile-name">${escapeHtml(p.name || 'Unknown')}</div>
        <div class="group-call__tile-indicators">
          ${p.muted ? '<span class="group-call__tile-muted">🔇</span>' : ''}
          ${p.videoOff ? '<span class="group-call__tile-video-off">📷</span>' : ''}
          ${uid === groupCallState.activeSpeakerId ? '<span class="group-call__tile-speaking">🔊</span>' : ''}
        </div>
      </div>`;
  }).join('');

  if (!isSpotlight) {
    html = `<div class="group-call__tile-grid">${tiles}</div>`;
  } else {
    html += `<div class="group-call__tile-strip">${tiles}</div>`;
  }

  container.innerHTML = html;

  // Attach media streams to video elements
  userIds.forEach(uid => {
    const videoEl = document.getElementById(`groupRemoteVideo_${uid}`);
    if (videoEl && groupCallState.remoteStreams[uid]) {
      if (videoEl.srcObject !== groupCallState.remoteStreams[uid]) {
        videoEl.srcObject = groupCallState.remoteStreams[uid];
      }
    }
    // Local stream for self
    if (uid === currentUser?.id && groupCallState.localStream) {
      const localVideo = document.getElementById(`groupRemoteVideo_${uid}`);
      if (localVideo && localVideo.srcObject !== groupCallState.localStream) {
        localVideo.srcObject = groupCallState.localStream;
      }
    }
  });
}

function showGroupCallUI() {
  const winId = groupCallState.chatWinId;
  if (!winId) return;

  // If there's an active 1-to-1 call in this window, save state first
  if (callState.active && callState.chatWinId === winId) {
    // End 1-to-1 call without clean-up of group
  }

  saveGroupCallChatState();
  const el = getGroupCallContainer();
  if (!el) return;

  const callType = groupCallState.callType;
  const participantCount = groupCallState.participantOrder.length;

  el.header.innerHTML = `
    <div class="chat-call__header-info">
      <span class="chat-call__header-label">📞 Group Call (${callType})</span>
      <span class="chat-call__header-name">${participantCount} participant${participantCount !== 1 ? 's' : ''}</span>
      <span class="group-call__timer chat-call__timer">00:00</span>
    </div>
    <div class="chat-call__header-actions">
      <button class="chat-window__header-btn" onclick="showRingtoneSettingsModal()" title="Ringtone Settings">⚙️</button>
      <button class="chat-window__header-btn" onclick="showGroupCallParticipantsList()" title="Add Participant">➕</button>
      <button class="chat-window__header-btn" onclick="closeChatWindow('${winId}')">✕</button>
    </div>`;

  el.messages.innerHTML = `
    <div class="group-call__container">
      <div class="group-call__main" id="groupCallParticipants"></div>
    </div>`;

  el.inputArea.innerHTML = `
    <div class="group-call__controls">
      <button class="chat-call__ctrl-btn" id="groupCallMuteBtn" onclick="toggleGroupCallMute()" title="Mute">
        ${ICONS.mic}<span>Mute</span>
      </button>
      ${callType === 'video' ? `
      <button class="chat-call__ctrl-btn" id="groupCallVideoBtn" onclick="toggleGroupCallVideo()" title="Video">
        ${ICONS.video}<span>Video</span>
      </button>` : ''}
      <button class="chat-call__ctrl-btn chat-call__ctrl-btn--end" onclick="leaveGroupCall()" title="Leave Call">
        ${ICONS.endCall}<span>Leave</span>
      </button>
      ${groupCallState.isCreator ? `
      <button class="chat-call__ctrl-btn chat-call__ctrl-btn--end" onclick="endGroupCall()" title="End Call for All" style="background:var(--danger)!important;">
        ${ICONS.endCall}<span>End All</span>
      </button>` : ''}
    </div>`;

  renderGroupCallParticipants();
  startGroupCallTimer();
}

function showGroupCallIncomingUI(callId, from, callType, participants) {
  // Remove any existing overlay
  document.getElementById('groupCallOverlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'groupCallOverlay';
  overlay.className = 'call-overlay call-overlay--incoming-full';
  overlay.innerHTML = `
    <div class="call-overlay__incoming-bg"></div>
    <div class="call-overlay__incoming-content">
      <div class="call-overlay__ring-pulse">
        <img class="call-overlay__avatar call-overlay__avatar--lg" src="${from.avatar || ''}" alt="${escapeHtml(from.name || 'Unknown')}" onerror="this.src='https://ui-avatars.com/api/?name=${from.name ? encodeURIComponent(from.name) : 'U'}&background=1877f2&color=fff&size=128'">
      </div>
      <div class="call-overlay__name">${escapeHtml(from.name || 'Unknown')}</div>
      <div class="call-overlay__status">Incoming group ${callType} call</div>
      <div class="call-overlay__participant-count">${participants.length} participant${participants.length !== 1 ? 's' : ''}</div>
      <div class="call-overlay__actions">
        <div class="call-overlay__action-group">
          <button class="call-btn call-btn--accept" onclick="acceptGroupCall('${callId}')" title="Join">${ICONS.phone}</button>
          <span>Join</span>
        </div>
        <div class="call-overlay__action-group">
          <button class="call-btn call-btn--reject" onclick="rejectGroupCall('${callId}')" title="Decline">${ICONS.phoneOff}</button>
          <span>Decline</span>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  startRingtone('incoming');
}

function showGroupCallParticipantsList() {
  const existing = document.getElementById('groupCallAddParticipantModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'groupCallAddParticipantModal';
  modal.className = 'group-call__add-modal-overlay';
  modal.innerHTML = `
    <div class="group-call__add-modal">
      <div class="group-call__add-modal-header">
        <span>Add Participant</span>
        <button onclick="document.getElementById('groupCallAddParticipantModal')?.remove()">✕</button>
      </div>
      <div class="group-call__add-modal-search">
        <input type="text" id="groupCallAddSearch" placeholder="Search friends..." autocomplete="off" oninput="groupCallSearchInput(this.value)" onkeydown="groupCallSearchKeydown(event)">
      </div>
      <div class="group-call__add-modal-list" id="groupCallCandidateList">
        <div style="padding:var(--space-md);text-align:center;color:var(--text-muted);font-size:var(--font-size-sm);">Loading...</div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('keydown', function(e) { if (e.key === 'Escape') modal.remove(); });
  const input = document.getElementById('groupCallAddSearch');
  if (input) { input.focus(); input.select(); }
  renderGroupCallCandidates();
}

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const escaped = escapeHtml(text);
  const q = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(' + q + ')', 'gi');
  return escaped.replace(re, '<em>$1</em>');
}

var groupCallSearchInput = debounce(function(value) {
  renderGroupCallCandidates(value);
}, 200);

function groupCallSearchKeydown(event) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
  event.preventDefault();
  const items = document.querySelectorAll('#groupCallCandidateList .group-call__candidate-item');
  if (!items.length) return;
  let idx = Array.from(items).findIndex(el => el.classList.contains('group-call__candidate-item--focused'));
  if (event.key === 'ArrowDown') {
    idx = idx < items.length - 1 ? idx + 1 : 0;
  } else if (event.key === 'ArrowUp') {
    idx = idx > 0 ? idx - 1 : items.length - 1;
  } else if (event.key === 'Enter') {
    if (idx >= 0 && idx < items.length) {
      const btn = items[idx].querySelector('.btn');
      if (btn) btn.click();
    }
    return;
  }
  items.forEach(function(el) { el.classList.remove('group-call__candidate-item--focused'); });
  if (idx >= 0) {
    items[idx].classList.add('group-call__candidate-item--focused');
    items[idx].scrollIntoView({ block: 'nearest' });
  }
}

function renderGroupCallCandidates(query) {
  const list = document.getElementById('groupCallCandidateList');
  if (!list) return;

  const inCall = new Set(groupCallState.participantOrder || []);
  const candidates = (allUsers || []).filter(u =>
    !inCall.has(u.id) && u.id !== currentUser?.id
  );

  const q = (query || '').toLowerCase().trim();
  const filtered = q
    ? candidates.filter(u => u.name.toLowerCase().includes(q) || (u.username || '').toLowerCase().includes(q))
    : candidates;

  if (!filtered.length) {
    list.innerHTML = `<div class="group-call__no-results"><div class="group-call__no-results-icon">🔍</div>No friends match your search</div>`;
    return;
  }

  list.innerHTML = filtered.map(function(u) {
    const nameHtml = q ? highlightMatch(u.name, q) : escapeHtml(u.name);
    return `
    <div class="group-call__candidate-item" onclick="inviteToGroupCall('${u.id}')">
      <img src="${u.avatar || ''}" alt="${escapeHtml(u.name)}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=random&color=fff&size=40'" class="group-call__candidate-avatar">
      <div class="group-call__candidate-info">
        <div class="group-call__candidate-name">${nameHtml}</div>
        <div class="group-call__candidate-status">${onlineUserIds?.has(u.id) ? '🟢 Online' : 'Offline'}</div>
      </div>
      <button class="btn btn--primary btn--xs">Invite</button>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════════════
// GROUP CALL — Actions
// ═══════════════════════════════════════════════════════════════════

async function startGroupCall(callType) {
  if (groupCallState.active) { SC.showError('Already in a group call'); return; }
  if (callState.active) { SC.showError('You are already in a call'); return; }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' });
    groupCallState.active = true;
    groupCallState.callType = callType;
    groupCallState.localStream = stream;
    groupCallState.isMuted = false;
    groupCallState.isVideoOff = false;
    groupCallState.isCreator = true;

    // Add self to participants
    const me = {
      name: currentUser?.name || 'Me',
      avatar: currentUser?.avatar || '',
      muted: false,
      videoOff: false,
    };
    groupCallState.participants[currentUser.id] = me;
    groupCallState.participantOrder = [currentUser.id];

    // Emit create group call
    socket.emit('create_group_call', { callType });

    // The 'group_call_created' handler will set callId and open UI
  } catch (err) {
    console.error('startGroupCall error:', err);
    SC.showError('Could not start group call: ' + (err.message || 'Unknown error'));
    groupCallCleanup();
  }
}

async function acceptGroupCall(callId) {
  stopRingtone();
  document.getElementById('groupCallOverlay')?.remove();

  if (groupCallState.active) return;
  if (callState.active) { SC.showError('You are already in a call'); return; }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: groupCallState.callType === 'video' });
    groupCallState.active = true;
    groupCallState.callId = callId;
    groupCallState.localStream = stream;
    groupCallState.isMuted = false;
    groupCallState.isVideoOff = false;
    groupCallState.isCreator = false;

    const me = {
      name: currentUser?.name || 'Me',
      avatar: currentUser?.avatar || '',
      muted: false,
      videoOff: false,
    };
    groupCallState.participants[currentUser.id] = me;
    groupCallState.participantOrder = [currentUser.id];

    socket.emit('group_call_join', { callId });
  } catch (err) {
    console.error('acceptGroupCall error:', err);
    SC.showError('Could not join group call');
  }
}

function rejectGroupCall(callId) {
  stopRingtone();
  document.getElementById('groupCallOverlay')?.remove();
  SC.showInfo('Group call declined');
}

function leaveGroupCall() {
  if (groupCallState.callId) {
    socket.emit('group_call_leave', { callId: groupCallState.callId });
  }
  groupCallCleanup();
  SC.showInfo('Left group call');
}

function endGroupCall() {
  if (groupCallState.callId && groupCallState.isCreator) {
    socket.emit('group_call_end', { callId: groupCallState.callId });
  }
  groupCallCleanup();
  SC.showInfo('Group call ended');
}

function inviteToGroupCall(userId) {
  if (!groupCallState.callId) return;
  socket.emit('group_call_invite', { callId: groupCallState.callId, userIds: [userId] });
  document.getElementById('groupCallAddParticipantModal')?.remove();
  SC.showInfo('Invitation sent!');
}

function toggleGroupCallMute() {
  groupCallState.isMuted = !groupCallState.isMuted;
  if (groupCallState.localStream) {
    const t = groupCallState.localStream.getAudioTracks()[0];
    if (t) t.enabled = !groupCallState.isMuted;
  }
  const btn = document.getElementById('groupCallMuteBtn');
  if (btn) {
    btn.innerHTML = groupCallState.isMuted ? `${ICONS.micOff}<span>Unmute</span>` : `${ICONS.mic}<span>Mute</span>`;
    btn.classList.toggle('chat-call__ctrl-btn--active', groupCallState.isMuted);
  }
  // Update own participant state
  if (groupCallState.participants[currentUser.id]) {
    groupCallState.participants[currentUser.id].muted = groupCallState.isMuted;
  }
}

function toggleGroupCallVideo() {
  if (groupCallState.callType !== 'video') return;
  groupCallState.isVideoOff = !groupCallState.isVideoOff;
  if (groupCallState.localStream) {
    const t = groupCallState.localStream.getVideoTracks()[0];
    if (t) t.enabled = !groupCallState.isVideoOff;
  }
  const btn = document.getElementById('groupCallVideoBtn');
  if (btn) {
    btn.innerHTML = groupCallState.isVideoOff ? `${ICONS.videoOff}<span>Video Off</span>` : `${ICONS.video}<span>Video</span>`;
    btn.classList.toggle('chat-call__ctrl-btn--active', groupCallState.isVideoOff);
  }
  if (groupCallState.participants[currentUser.id]) {
    groupCallState.participants[currentUser.id].videoOff = groupCallState.isVideoOff;
  }
}

function groupCallCleanup() {
  stopGroupCallTimer();
  stopRingtone();

  // Close all peer connections
  Object.values(groupCallState.peerConnections).forEach(pc => pc.close());
  groupCallState.peerConnections = {};
  groupCallState.remoteStreams = {};

  // Stop audio context / speaker detection
  if (groupCallState.audioContext) {
    groupCallState.audioContext.close();
    groupCallState.audioContext = null;
  }
  if (groupCallState.speakerCheckInterval) {
    clearInterval(groupCallState.speakerCheckInterval);
    groupCallState.speakerCheckInterval = null;
  }

  // Stop local stream
  if (groupCallState.localStream) {
    groupCallState.localStream.getTracks().forEach(t => t.stop());
    groupCallState.localStream = null;
  }

  groupCallState.participants = {};
  groupCallState.participantOrder = [];
  groupCallState.activeSpeakerId = null;
  groupCallState.active = false;
  groupCallState.isCreator = false;

  document.getElementById('groupCallOverlay')?.remove();
  document.getElementById('groupCallAddParticipantModal')?.remove();
  restoreGroupCallChatState();
}

// Speaker detection using Web Audio API
function startSpeakerDetection() {
  if (!groupCallState.localStream || groupCallState.callType !== 'audio') return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    groupCallState.audioContext = audioCtx;
    const source = audioCtx.createMediaStreamSource(groupCallState.localStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    groupCallState.analyserNode = analyser;

    groupCallState.speakerCheckInterval = setInterval(() => {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      // If local user is speaking, emit speaker change
      if (avg > 20 && groupCallState.callId) {
        socket.emit('group_call_speaker_change', {
          callId: groupCallState.callId,
          activeSpeakerId: currentUser.id,
        });
      }
    }, 300);
  } catch (e) {
    console.warn('Speaker detection not available:', e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// GROUP CALL — Socket Handlers
// ═══════════════════════════════════════════════════════════════════

socket.on('group_call_created', ({ callId }) => {
  groupCallState.callId = callId;
  showGroupCallUI();
  startSpeakerDetection();
});

socket.on('group_call_joined', ({ callId, participants }) => {
  groupCallState.callId = callId;
  const newList = participants || [];
  // Add all existing participants
  newList.forEach(uid => {
    if (!groupCallState.participants[uid]) {
      const u = (allUsers || []).find(u => u.id === uid);
      groupCallState.participants[uid] = {
        name: u?.name || 'Unknown',
        avatar: u?.avatar || '',
        muted: false,
        videoOff: false,
      };
    }
  });
  groupCallState.participantOrder = newList;

  const firstOther = newList.find(id => id !== currentUser.id);
  if (firstOther) {
    const p = groupCallState.participants[firstOther];
    if (p && !getChatWindow(firstOther)) {
      window?.openChat?.(firstOther, p.name, p.avatar);
    }
    groupCallState.chatWinId = firstOther;
  }
  showGroupCallUI();
  startSpeakerDetection();
  // Init WebRTC connections to existing participants (joiner initiates, avoids glare)
  newList.forEach(uid => {
    if (uid !== currentUser.id && !groupCallState.peerConnections[uid]) {
      initGroupCallPeerConnection(uid);
    }
  });
});

socket.on('group_call_incoming', ({ callId, from, callType, participants }) => {
  groupCallState.callId = callId;
  groupCallState.callType = callType;
  showGroupCallIncomingUI(callId, from, callType, participants);
});

socket.on('group_call_participant_joined', ({ userId, participants }) => {
  // Update participant list
  const newList = participants || [];
  newList.forEach(uid => {
    if (!groupCallState.participants[uid]) {
      const u = (allUsers || []).find(u => u.id === uid);
      groupCallState.participants[uid] = {
        name: u?.name || 'Unknown',
        avatar: u?.avatar || '',
        muted: false,
        videoOff: false,
      };
    }
  });
  groupCallState.participantOrder = newList;

  // Don't initiate WebRTC here — the joiner initiates, avoiding glare.
  // The joiner's offer will arrive via group_webrtc_offer and create the PC.

  renderGroupCallParticipants();
  updateGroupCallHeader();
});

socket.on('group_call_participant_left', ({ userId, participants }) => {
  // Close peer connection for this user
  if (groupCallState.peerConnections[userId]) {
    groupCallState.peerConnections[userId].close();
    delete groupCallState.peerConnections[userId];
  }
  delete groupCallState.remoteStreams[userId];
  delete groupCallState.participants[userId];

  groupCallState.participantOrder = participants || [];
  renderGroupCallParticipants();
  updateGroupCallHeader();
});

socket.on('group_call_ended', ({ callId }) => {
  if (groupCallState.callId === callId) {
    SC.showInfo('Group call ended');
    groupCallCleanup();
  }
});

socket.on('group_call_error', ({ error }) => {
  SC.showError(error || 'Group call error');
});

// Group call WebRTC signaling
async function initGroupCallPeerConnection(userId) {
  if (!groupCallState.localStream) return;
  if (groupCallState.peerConnections[userId]) return;

  const pc = new RTCPeerConnection(RTC_CONFIG);
  groupCallState.peerConnections[userId] = pc;

  groupCallState.localStream.getTracks().forEach(track => {
    pc.addTrack(track, groupCallState.localStream);
  });

  pc.ontrack = (event) => {
    groupCallState.remoteStreams[userId] = event.streams[0];
    renderGroupCallParticipants();
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('group_webrtc_ice_candidate', {
        callId: groupCallState.callId,
        toUserId: userId,
        candidate: event.candidate,
      });
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      delete groupCallState.peerConnections[userId];
      delete groupCallState.remoteStreams[userId];
      renderGroupCallParticipants();
    }
  };

  // Create and send offer
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('group_webrtc_offer', {
      callId: groupCallState.callId,
      toUserId: userId,
      offer,
    });
  } catch (err) {
    console.error('Error creating group call offer:', err);
  }
}

socket.on('group_webrtc_offer', async ({ from, callId, offer }) => {
  if (!groupCallState.active || groupCallState.callId !== callId) return;

  // Ensure peer connection exists
  if (!groupCallState.peerConnections[from]) {
    if (!groupCallState.localStream) return;
    const pc = new RTCPeerConnection(RTC_CONFIG);
    groupCallState.peerConnections[from] = pc;

    groupCallState.localStream.getTracks().forEach(track => {
      pc.addTrack(track, groupCallState.localStream);
    });

    pc.ontrack = (event) => {
      groupCallState.remoteStreams[from] = event.streams[0];
      renderGroupCallParticipants();
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('group_webrtc_ice_candidate', {
          callId: groupCallState.callId,
          toUserId: from,
          candidate: event.candidate,
        });
      }
    };
  }

  const pc = groupCallState.peerConnections[from];
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('group_webrtc_answer', {
      callId: groupCallState.callId,
      toUserId: from,
      answer,
    });
  } catch (err) {
    console.error('Error handling group offer:', err);
  }
});

socket.on('group_webrtc_answer', async ({ from, callId, answer }) => {
  if (!groupCallState.active || groupCallState.callId !== callId) return;
  const pc = groupCallState.peerConnections[from];
  if (!pc) return;
  try {
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (err) {
    console.error('Error handling group answer:', err);
  }
});

socket.on('group_webrtc_ice_candidate', async ({ from, callId, candidate }) => {
  if (!groupCallState.active || groupCallState.callId !== callId) return;
  const pc = groupCallState.peerConnections[from];
  if (!pc || !candidate) return;
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error('Error handling group ICE candidate:', err);
  }
});

socket.on('group_call_speaker_change', ({ activeSpeakerId }) => {
  groupCallState.activeSpeakerId = activeSpeakerId;
  renderGroupCallParticipants();
});

function updateGroupCallHeader() {
  const winId = groupCallState.chatWinId;
  if (!winId) return;
  const el = getGroupCallContainer();
  if (!el) return;
  const count = groupCallState.participantOrder.length;
  const nameEl = el.header?.querySelector('.chat-call__header-name');
  if (nameEl) nameEl.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
}

socket.on('incoming_call', ({ from, callType }) => {
  if (callState.active) { socket.emit('call_rejected', { toUserId: from.id }); return; }
  callState.callType = callType;
  callState.peerId = from.id;
  callState.peerName = from.name || 'Unknown';
  callState.peerAvatar = from.avatar || '';
  callState.isCaller = false;
  showIncomingCallUI(callState.peerName, callState.peerAvatar, callType);
});

socket.on('user_not_available', () => {
  SC.showError('User is not available for a call');
  endCallCleanup();
});

socket.on('call_accepted', () => {
  if (callState.callTimeout) { clearTimeout(callState.callTimeout); callState.callTimeout = null; }
  stopRingtone();
  showActiveCallUI();
  startCallTimer();
});

socket.on('call_rejected', () => {
  if (callState.callTimeout) { clearTimeout(callState.callTimeout); callState.callTimeout = null; }
  SC.showError('Call was rejected');
  endCallCleanup();
});

socket.on('call_ended', () => {
  if (callState.callTimeout) { clearTimeout(callState.callTimeout); callState.callTimeout = null; }
  SC.showInfo('Call ended');
  endCallCleanup();
});

socket.on('webrtc_offer', async ({ from, offer }) => {
  if (!callState.peerConnection) {
    // Buffer the offer — user hasn't accepted yet
    callState.pendingOffer = offer;
    return;
  }
  try {
    await callState.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await callState.peerConnection.createAnswer();
    await callState.peerConnection.setLocalDescription(answer);
    socket.emit('webrtc_answer', { toUserId: from, answer });
    if (callState.callTimeout) { clearTimeout(callState.callTimeout); callState.callTimeout = null; }
    stopRingtone();
    showActiveCallUI();
    startCallTimer();
  } catch (err) { console.error('Error handling offer:', err); }
});

socket.on('webrtc_answer', async ({ from, answer }) => {
  if (!callState.peerConnection) return;
  try { await callState.peerConnection.setRemoteDescription(new RTCSessionDescription(answer)); }
  catch (err) { console.error('Error handling answer:', err); }
});

socket.on('webrtc_ice_candidate', async ({ from, candidate }) => {
  if (!callState.peerConnection || !candidate) return;
  try { await callState.peerConnection.addIceCandidate(new RTCIceCandidate(candidate)); }
  catch (err) { console.error('Error adding ICE candidate:', err); }
});
