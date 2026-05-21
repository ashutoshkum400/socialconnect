/* ==========================================================================
   SocialConnect — call.js
   WebRTC Audio/Video calling module with UI overlays and ringtone generation
   ========================================================================== */

'use strict';

// ─── SVG Icons (inline, no external dependencies) ────────────────────────
const ICONS = {
  phone: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  phoneOff: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="23" y1="1" x2="1" y2="23"/></svg>`,
  video: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
  videoOff: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
  micOff: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`,
  endCall: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  phoneIncoming: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 2 16 8 22 8"/><line x1="23" y1="1" x2="16" y2="8"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
};

// ─── Global Call State ───────────────────────────────────────────────────
const callState = {
  active: false,
  callType: null,        // 'audio' or 'video'
  peerConnection: null,
  localStream: null,
  remoteStream: null,
  peerId: null,
  peerName: '',
  peerAvatar: '',
  isCaller: false,
  startTime: null,
  timerInterval: null,
  isMuted: false,
  isVideoOff: false,
  audioContext: null,     // Web Audio API context for ringtone
};

// ─── WebRTC Configuration ───────────────────────────────────────────────
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// RINGTONES (Web Audio API — no external files)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Start a repeating ringtone.
 * @param {'incoming'|'outgoing'} type
 */
function startRingtone(type) {
  // Close any existing tone
  stopRingtone();

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  callState.audioContext = audioCtx;

  const isIncoming = type === 'incoming';
  const onDuration  = isIncoming ? 0.5 : 0.2;
  const offDuration = isIncoming ? 0.5 : 0.3;
  const freqA = isIncoming ? 440 : 440;
  const freqB = isIncoming ? 480 : 440;

  let toneIndex = 0;
  let nextTime = audioCtx.currentTime;

  function scheduleTone() {
    if (!callState.audioContext || callState.audioContext !== audioCtx) return;

    const now = audioCtx.currentTime;
    if (nextTime < now) nextTime = now;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(toneIndex % 2 === 0 ? freqA : freqB, nextTime);
    gain.gain.setValueAtTime(0.3, nextTime);
    gain.gain.exponentialRampToValueAtTime(0.01, nextTime + onDuration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(nextTime);
    osc.stop(nextTime + onDuration);

    toneIndex++;
    nextTime += onDuration + offDuration;

    callState._ringtoneTimer = setTimeout(scheduleTone, (nextTime - audioCtx.currentTime) * 1000);
  }

  scheduleTone();
}

/**
 * Stop the currently playing ringtone.
 */
function stopRingtone() {
  if (callState._ringtoneTimer) {
    clearTimeout(callState._ringtoneTimer);
    callState._ringtoneTimer = null;
  }
  if (callState.audioContext) {
    callState.audioContext.close();
    callState.audioContext = null;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CALL TIMER
// ═══════════════════════════════════════════════════════════════════════

function startCallTimer() {
  callState.startTime = Date.now();
  callState.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callState.startTime) / 1000);
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    const el = document.getElementById('callTimer');
    if (el) el.textContent = `${mins}:${secs}`;
  }, 1000);
}

function stopCallTimer() {
  clearInterval(callState.timerInterval);
  callState.timerInterval = null;
  callState.startTime = null;
}

// ═══════════════════════════════════════════════════════════════════════
// CALL UI OVERLAYS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Show the incoming call notification overlay.
 */
function showIncomingCallOverlay(name, avatar, callType) {
  hideCallOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'callOverlay';
  overlay.className = 'call-overlay';

  overlay.innerHTML = `
    <div class="call-overlay__content">
      <div class="call-overlay__ring-pulse"></div>
      <img class="call-overlay__avatar" src="${avatar}" alt="${name}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1877f2&color=fff&size=128'">
      <div class="call-overlay__name">${name}</div>
      <div class="call-overlay__status">Incoming ${callType} call...</div>
      <div class="call-overlay__actions">
        <button class="call-btn call-btn--accept" onclick="acceptCall()" title="Accept">
          ${callType === 'video' ? ICONS.video : ICONS.phone}
        </button>
        <button class="call-btn call-btn--reject" onclick="rejectCall()" title="Reject">
          ${ICONS.phoneOff}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  startRingtone('incoming');
}

/**
 * Show the active call UI (replaces incoming overlay).
 */
function showActiveCallOverlay() {
  // Remove existing overlay first
  const existing = document.getElementById('callOverlay');
  if (existing) existing.remove();

  const isVideo = callState.callType === 'video';
  const overlay = document.createElement('div');
  overlay.id = 'callOverlay';
  overlay.className = `call-overlay call-overlay--active`;

  let innerHTML = '';

  if (isVideo) {
    innerHTML = `
      <video id="remoteVideo" class="call-overlay__remote-video" autoplay playsinline></video>
      <video id="localVideo" class="call-overlay__local-video" autoplay playsinline muted></video>
      <div class="call-overlay__info">
        <div class="call-overlay__name">${callState.peerName}</div>
        <div id="callTimer" class="call-overlay__timer">00:00</div>
      </div>
      <div class="call-overlay__controls">
        <button class="call-control-btn" id="callMuteBtn" onclick="toggleMute()">
          ${ICONS.mic}
          <span>Mute</span>
        </button>
        <button class="call-control-btn call-control-btn--end" onclick="endCall()">
          ${ICONS.endCall}
          <span>End</span>
        </button>
        <button class="call-control-btn" id="callVideoBtn" onclick="toggleVideo()">
          ${ICONS.video}
          <span>Video</span>
        </button>
      </div>
    `;
  } else {
    innerHTML = `
      <div class="call-overlay__audio-bg">
        <div class="call-overlay__ring-pulse call-overlay__ring-pulse--slow"></div>
        <img class="call-overlay__avatar call-overlay__avatar--large" src="${callState.peerAvatar}" alt="${callState.peerName}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(callState.peerName)}&background=1877f2&color=fff&size=128'">
      </div>
      <div class="call-overlay__info">
        <div class="call-overlay__name">${callState.peerName}</div>
        <div id="callTimer" class="call-overlay__timer">00:00</div>
      </div>
      <div class="call-overlay__controls">
        <button class="call-control-btn" id="callMuteBtn" onclick="toggleMute()">
          ${ICONS.mic}
          <span>Mute</span>
        </button>
        <button class="call-control-btn" id="callSpeakerBtn" onclick="toggleSpeaker()">
          ${ICONS.speaker}
          <span>Speaker</span>
        </button>
        <button class="call-control-btn call-control-btn--end" onclick="endCall()">
          ${ICONS.endCall}
          <span>End</span>
        </button>
      </div>
    `;
  }

  overlay.innerHTML = innerHTML;
  document.body.appendChild(overlay);

  // Attach media streams to video elements after DOM insertion
  if (isVideo) {
    const remoteVideo = document.getElementById('remoteVideo');
    const localVideo  = document.getElementById('localVideo');

    if (remoteVideo && callState.remoteStream) {
      remoteVideo.srcObject = callState.remoteStream;
    }
    if (localVideo && callState.localStream) {
      localVideo.srcObject = callState.localStream;
    }
  }
}

/**
 * Remove all call overlay elements from the DOM.
 */
function hideCallOverlay() {
  const overlay = document.getElementById('callOverlay');
  if (overlay) overlay.remove();
}

// ═══════════════════════════════════════════════════════════════════════
// CORE CALL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Caller initiates a call to another user.
 */
async function startCall(userId, userName, userAvatar, callType) {
  if (callState.active) {
    SC.showError('You are already in a call');
    return;
  }

  try {
    // Get local media
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video',
    });

    // Store call state
    callState.active = true;
    callState.isCaller = true;
    callState.callType = callType;
    callState.peerId = userId;
    callState.peerName = userName;
    callState.peerAvatar = userAvatar;
    callState.localStream = stream;
    callState.isMuted = false;
    callState.isVideoOff = false;

    // Create peer connection
    const pc = new RTCPeerConnection(RTC_CONFIG);
    callState.peerConnection = pc;

    // Add local tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Remote stream handler
    pc.ontrack = (event) => {
      callState.remoteStream = event.streams[0];
      // Update remote video element if it exists
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo && remoteVideo.srcObject !== event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc_ice_candidate', {
          toUserId: callState.peerId,
          candidate: event.candidate,
        });
      }
    };

    // Connection state logging
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        if (callState.active) {
          SC.showInfo('Call disconnected');
          endCallCleanup();
        }
      }
    };

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit('webrtc_offer', { toUserId: userId, offer });

    // Notify server
    socket.emit('call_user', { toUserId: userId, callType });

    // Show incoming call UI (caller sees this while waiting)
    showActiveCallOverlay();

    // Start outgoing ringback tone
    startRingtone('outgoing');

  } catch (err) {
    console.error('startCall error:', err);
    SC.showError('Could not start call: ' + (err.message || 'Unknown error'));
    endCallCleanup();
  }
}

/**
 * Callee accepts an incoming call.
 */
async function acceptCall() {
  if (!callState.peerId) return;

  try {
    // Get local media
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callState.callType === 'video',
    });

    callState.active = true;
    callState.localStream = stream;
    callState.isMuted = false;
    callState.isVideoOff = false;

    // Create peer connection
    const pc = new RTCPeerConnection(RTC_CONFIG);
    callState.peerConnection = pc;

    // Add local tracks
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    // Remote stream handler
    pc.ontrack = (event) => {
      callState.remoteStream = event.streams[0];
      const remoteVideo = document.getElementById('remoteVideo');
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
      }
    };

    // ICE candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc_ice_candidate', {
          toUserId: callState.peerId,
          candidate: event.candidate,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        if (callState.active) {
          SC.showInfo('Call disconnected');
          endCallCleanup();
        }
      }
    };

    // Notify server that call was accepted
    socket.emit('call_accepted', { toUserId: callState.peerId });

  } catch (err) {
    console.error('acceptCall error:', err);
    SC.showError('Could not accept call: ' + (err.message || 'Unknown error'));
    rejectCall();
  }
}

/**
 * Callee rejects an incoming call.
 */
function rejectCall() {
  if (callState.peerId) {
    socket.emit('call_rejected', { toUserId: callState.peerId });
  }
  stopRingtone();
  hideCallOverlay();
  callState.active = false;
  callState.peerId = null;
  callState.callType = null;
}

/**
 * Either party ends the call.
 */
function endCall() {
  if (callState.peerId) {
    socket.emit('call_end', { toUserId: callState.peerId });
  }
  endCallCleanup();
}

/**
 * Toggle local audio mute.
 */
function toggleMute() {
  callState.isMuted = !callState.isMuted;
  if (callState.localStream) {
    const audioTrack = callState.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !callState.isMuted;
    }
  }
  const btn = document.getElementById('callMuteBtn');
  if (btn) {
    btn.innerHTML = callState.isMuted
      ? `${ICONS.micOff}<span>Unmute</span>`
      : `${ICONS.mic}<span>Mute</span>`;
    btn.classList.toggle('call-control-btn--active', callState.isMuted);
  }
}

/**
 * Toggle local video on/off.
 */
function toggleVideo() {
  if (callState.callType !== 'video') return;
  callState.isVideoOff = !callState.isVideoOff;
  if (callState.localStream) {
    const videoTrack = callState.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !callState.isVideoOff;
    }
  }
  const btn = document.getElementById('callVideoBtn');
  if (btn) {
    btn.innerHTML = callState.isVideoOff
      ? `${ICONS.videoOff}<span>Video Off</span>`
      : `${ICONS.video}<span>Video</span>`;
    btn.classList.toggle('call-control-btn--active', callState.isVideoOff);
  }
}

/**
 * Toggle speaker/earpiece (visual toggle only).
 */
function toggleSpeaker() {
  const btn = document.getElementById('callSpeakerBtn');
  if (btn) {
    btn.classList.toggle('call-control-btn--active');
    const span = btn.querySelector('span');
    if (span) {
      span.textContent = btn.classList.contains('call-control-btn--active') ? 'Earpiece' : 'Speaker';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CLEANUP HELPER
// ═══════════════════════════════════════════════════════════════════════

function endCallCleanup() {
  stopCallTimer();
  stopRingtone();

  if (callState.peerConnection) {
    callState.peerConnection.close();
    callState.peerConnection = null;
  }

  if (callState.localStream) {
    callState.localStream.getTracks().forEach(t => t.stop());
    callState.localStream = null;
  }

  callState.remoteStream = null;
  callState.active = false;
  callState.isCaller = false;
  callState.peerId = null;
  callState.peerName = '';
  callState.peerAvatar = '';
  callState.callType = null;
  callState.isMuted = false;
  callState.isVideoOff = false;

  hideCallOverlay();
}

// ═══════════════════════════════════════════════════════════════════════
// SOCKET EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Incoming call from another user.
 */
socket.on('incoming_call', ({ from, callType }) => {
  if (callState.active) {
    // Already in a call — inform the caller we're busy
    socket.emit('call_rejected', { toUserId: from.id });
    return;
  }

  callState.callType = callType;
  callState.peerId = from.id;
  callState.peerName = from.name || 'Unknown';
  callState.peerAvatar = from.avatar || '';
  callState.isCaller = false;

  showIncomingCallOverlay(callState.peerName, callState.peerAvatar, callType);
});

/**
 * Called user is not available (offline or doesn't exist).
 */
socket.on('user_not_available', () => {
  SC.showError('User is not available for a call');
  endCallCleanup();
});

/**
 * Callee accepted the call.
 */
socket.on('call_accepted', ({ from }) => {
  SC.showSuccess('Call connected');
  stopRingtone();
  // Active call UI is already shown for the caller
  const timerEl = document.getElementById('callTimer');
  if (!timerEl) {
    // Re-show active UI if needed (should already be showing)
    showActiveCallOverlay();
  }
  startCallTimer();
});

/**
 * Call was rejected by the other party.
 */
socket.on('call_rejected', ({ from }) => {
  SC.showError('Call was rejected');
  endCallCleanup();
});

/**
 * Other party ended the call.
 */
socket.on('call_ended', ({ from }) => {
  SC.showInfo('Call ended');
  endCallCleanup();
});

/**
 * Receive WebRTC offer (for callee to process).
 */
socket.on('webrtc_offer', async ({ from, offer }) => {
  if (!callState.peerConnection) return;
  try {
    await callState.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await callState.peerConnection.createAnswer();
    await callState.peerConnection.setLocalDescription(answer);
    socket.emit('webrtc_answer', { toUserId: from, answer });

    // Callee switches to active call UI
    showActiveCallOverlay();
    startCallTimer();
  } catch (err) {
    console.error('Error handling offer:', err);
  }
});

/**
 * Receive WebRTC answer (for caller to finalize connection).
 */
socket.on('webrtc_answer', async ({ from, answer }) => {
  if (!callState.peerConnection) return;
  try {
    await callState.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  } catch (err) {
    console.error('Error handling answer:', err);
  }
});

/**
 * Receive ICE candidate for peer connection.
 */
socket.on('webrtc_ice_candidate', async ({ from, candidate }) => {
  if (!callState.peerConnection || !candidate) return;
  try {
    await callState.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error('Error adding ICE candidate:', err);
  }
});