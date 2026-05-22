/* ═════════════════════════════════════════════════════════════════════════════
   ADVANCED POST SYSTEM - Ultra High-End Social Media Posting
   Features: Multimedia, Location, Feelings, Tags, Mentions, Highlights, Privacy
   ═════════════════════════════════════════════════════════════════════════════ */

'use strict';

var AdvancedPost = {
  // ─────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────
  state: {
    text: '',
    media: {
      photos: [],
      videos: [],
      audio: [],
    },
    location: null,
    feeling: null,
    activity: null,
    tags: [],
    mentions: [],
    highlights: [],
    privacySettings: {
      sharedWith: 'public', // 'public', 'friends', 'followers', 'specific'
      specificUsers: [],
      parallelize: true,
      datingSiteShare: false,
      hideFrom: [],
    },
    reactions: {
      likes: [],
      comments: [],
      shares: [],
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // INITIALIZE
  // ─────────────────────────────────────────────────────────────────────────
  async init() {
    console.log('🚀 Initializing Advanced Post System...');
    this.currentUser = this.getCurrentUser();
    this.setupEventListeners();
    this.setupMediaHandlers();
    this.loadEmojis();
    this.setupAutoSave();
  },

  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('sc_user') || '{}');
    } catch {
      return {};
    }
  },

  setupEventListeners() {
    // Note: The advancedPostBtn click handler is set up in dashboard.js
    // to avoid duplicate handlers. This method only wires modal-internal elements.

    // Main post button in modal
    const submitBtn = document.getElementById('advPostSubmit');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitPost());
    }

    // Close modal
    const closeBtn = document.getElementById('advPostClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closePostModal());
    }

    // Text area
    const textArea = document.getElementById('advPostText');
    if (textArea) {
      textArea.addEventListener('input', (e) => {
        this.state.text = e.target.value;
        this.updateCharCount();
        this.autoSuggestMentions(e.target.value);
        this.autoDetectHashtags(e.target.value);
      });
    }

    // Media upload tabs
    document.querySelectorAll('[data-media-type]').forEach(btn => {
      btn.addEventListener('click', (e) => this.showMediaUploadPanel(e.target.dataset.mediaType));
    });

    // Location button
    const locationBtn = document.getElementById('advPostLocationBtn');
    if (locationBtn) {
      locationBtn.addEventListener('click', () => this.openLocationPicker());
    }

    // Feeling button
    const feelingBtn = document.getElementById('advPostFeelingBtn');
    if (feelingBtn) {
      feelingBtn.addEventListener('click', () => this.openFeelingPicker());
    }

    // Activity button
    const activityBtn = document.getElementById('advPostActivityBtn');
    if (activityBtn) {
      activityBtn.addEventListener('click', () => this.openActivityPicker());
    }

    // Privacy settings
    const privacyBtn = document.getElementById('advPostPrivacyBtn');
    if (privacyBtn) {
      privacyBtn.addEventListener('click', () => this.openPrivacySettings());
    }

    // Mentions button
    const mentionsBtn = document.getElementById('advPostMentionsBtn');
    if (mentionsBtn) {
      mentionsBtn.addEventListener('click', () => this.openMentionsList());
    }

    // Tags button
    const tagsBtn = document.getElementById('advPostTagsBtn');
    if (tagsBtn) {
      tagsBtn.addEventListener('click', () => this.openTagsList());
    }

    // Highlights button
    const highlightsBtn = document.getElementById('advPostHighlightsBtn');
    if (highlightsBtn) {
      highlightsBtn.addEventListener('click', () => this.openHighlightsList());
    }
  },

  setupMediaHandlers() {
    // Photo upload
    const photoInput = document.getElementById('advPostPhotoInput');
    if (photoInput) {
      photoInput.addEventListener('change', (e) => this.handlePhotoUpload(e));
    }

    // Video upload
    const videoInput = document.getElementById('advPostVideoInput');
    if (videoInput) {
      videoInput.addEventListener('change', (e) => this.handleVideoUpload(e));
    }

    // Audio upload
    const audioInput = document.getElementById('advPostAudioInput');
    if (audioInput) {
      audioInput.addEventListener('change', (e) => this.handleAudioUpload(e));
    }

    // Drag and drop
    const dropZone = document.getElementById('advPostDropZone');
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary)';
        dropZone.style.backgroundColor = 'rgba(88, 86, 214, 0.1)';
      });

      dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.backgroundColor = 'transparent';
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.backgroundColor = 'transparent';
        this.handleDroppedFiles(e.dataTransfer.files);
      });
    }
  },

  loadEmojis() {
    this.emojis = {
      feelings: [
        '😊 Happy', '😢 Sad', '😤 Frustrated', '😴 Tired', '🤔 Thoughtful',
        '😍 Loved', '😡 Angry', '😎 Cool', '🤗 Grateful', '😂 Laughing',
        '😌 Relaxed', '🤩 Impressed', '😇 Blessed', '🥳 Celebrating', '😌 Peaceful'
      ],
      activities: [
        '💼 Working', '🏃 Exercising', '📚 Studying', '🎬 Watching',
        '🍽️ Eating', '🎮 Gaming', '🎵 Listening to Music', '🚗 Traveling',
        '🏖️ Vacationing', '☕ Having Coffee', '🛍️ Shopping', '🎭 Performing',
        '🏥 At Hospital', '✈️ Flying', '🎉 At Party'
      ]
    };
  },

  setupAutoSave() {
    setInterval(() => {
      if (this.state.text.length > 0) {
        this.saveDraft();
      }
    }, 30000); // Save every 30 seconds
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MODAL MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
openPostModal() {
    const modal = document.getElementById('advPostModal');
    if (modal) {
      // Populate user info from current user
      this.currentUser = this.getCurrentUser();
      
      // Update avatar
      const avatarEl = document.getElementById('createPostAvatar');
      if (avatarEl) {
        avatarEl.src = this.currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.name || 'User')}&background=random&color=fff&size=40`;
      }
      
      // Update user name and handle using explicit IDs
      const userNameEl = document.getElementById('advPostUserName');
      if (userNameEl) {
        userNameEl.textContent = this.currentUser.name || 'User';
      }
      const userHandleEl = document.getElementById('advPostUserHandle');
      if (userHandleEl) {
        userHandleEl.textContent = `@${this.currentUser.username || 'user'}`;
      }
      
      modal.style.display = 'flex';
      modal.style.opacity = '0';
      setTimeout(() => modal.style.opacity = '1', 10);
      this.loadDraft();
    }
  },

  closePostModal() {
    const modal = document.getElementById('advPostModal');
    if (modal) {
      modal.style.opacity = '0';
      setTimeout(() => modal.style.display = 'none', 300);
      this.resetState();
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TEXT EDITOR
  // ─────────────────────────────────────────────────────────────────────────
  updateCharCount() {
    const counter = document.getElementById('advPostCharCount');
    if (counter) {
      const count = this.state.text.length;
      const maxChars = 10000;
      counter.textContent = `${count}/${maxChars}`;
      if (count > maxChars * 0.9) {
        counter.style.color = 'var(--warning)';
      } else if (count > 0) {
        counter.style.color = 'var(--text-muted)';
      }
    }
  },

  autoSuggestMentions(text) {
    const mentionMatch = text.match(/@(\w*)$/);
    if (mentionMatch) {
      this.showMentionSuggestions(mentionMatch[1]);
    }
  },

  autoDetectHashtags(text) {
    const hashtagMatches = text.match(/#(\w+)/g) || [];
    const tags = hashtagMatches.map(tag => tag.substring(1));
    this.state.tags = tags;
    this.updateTagsUI();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MEDIA HANDLING
  // ─────────────────────────────────────────────────────────────────────────
  handlePhotoUpload(event) {
    const files = Array.from(event.target.files || []);
    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        this.addMediaFile(file, 'photo');
      }
    });
    this.updateMediaUI();
  },

  handleVideoUpload(event) {
    const files = Array.from(event.target.files || []);
    files.forEach(file => {
      if (file.type.startsWith('video/')) {
        this.addMediaFile(file, 'video');
      }
    });
    this.updateMediaUI();
  },

  handleAudioUpload(event) {
    const files = Array.from(event.target.files || []);
    files.forEach(file => {
      if (file.type.startsWith('audio/')) {
        this.addMediaFile(file, 'audio');
      }
    });
    this.updateMediaUI();
  },

  handleDroppedFiles(files) {
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        this.addMediaFile(file, 'photo');
      } else if (file.type.startsWith('video/')) {
        this.addMediaFile(file, 'video');
      } else if (file.type.startsWith('audio/')) {
        this.addMediaFile(file, 'audio');
      }
    });
    this.updateMediaUI();
  },

  addMediaFile(file, type) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const mediaItem = {
        id: this.generateId(),
        type: type,
        name: file.name,
        size: file.size,
        data: e.target.result,
        thumbnail: type === 'photo' ? e.target.result : null,
        duration: null,
      };

      if (type === 'photo') {
        this.state.media.photos.push(mediaItem);
      } else if (type === 'video') {
        this.state.media.videos.push(mediaItem);
      } else if (type === 'audio') {
        this.state.media.audio.push(mediaItem);
      }
    };
    reader.readAsDataURL(file);
  },

  updateMediaUI() {
    const container = document.getElementById('advPostMediaContainer');
    if (!container) return;

    let html = '';

    // Photos
    this.state.media.photos.forEach((photo, idx) => {
      html += `
        <div class="media-item" data-id="${photo.id}">
          <img src="${photo.data}" alt="Photo ${idx + 1}" class="media-thumbnail">
          <button type="button" class="media-remove" onclick="AdvancedPost.removeMedia('${photo.id}', 'photo')">
            <span>✕</span>
          </button>
        </div>
      `;
    });

    // Videos
    this.state.media.videos.forEach((video, idx) => {
      html += `
        <div class="media-item video-item">
          <div class="media-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            <div class="media-label">${video.name}</div>
          </div>
          <button type="button" class="media-remove" onclick="AdvancedPost.removeMedia('${video.id}', 'video')">
            <span>✕</span>
          </button>
        </div>
      `;
    });

    // Audio
    this.state.media.audio.forEach((audio, idx) => {
      html += `
        <div class="media-item audio-item">
          <div class="media-placeholder">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v9.28c-.47-.46-1.12-.75-1.84-.75-1.66 0-3 1.34-3 3s1.34 3 3 3c1.66 0 3-1.34 3-3V7h4V3h-4z"/>
            </svg>
            <div class="media-label">${audio.name}</div>
          </div>
          <button type="button" class="media-remove" onclick="AdvancedPost.removeMedia('${audio.id}', 'audio')">
            <span>✕</span>
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
    if (html) container.style.display = 'grid';
    else container.style.display = 'none';
  },

  removeMedia(id, type) {
    const typeMap = { photo: 'photos', video: 'videos', audio: 'audio' };
    const key = typeMap[type];
    this.state.media[key] = this.state.media[key].filter(m => m.id !== id);
    this.updateMediaUI();
  },

  showMediaUploadPanel(type) {
    const inputs = {
      photo: 'advPostPhotoInput',
      video: 'advPostVideoInput',
      audio: 'advPostAudioInput',
    };
    document.getElementById(inputs[type])?.click();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // LOCATION PICKER
  // ─────────────────────────────────────────────────────────────────────────
  openLocationPicker() {
    const modal = document.getElementById('advPostLocationModal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-overlay-content" style="max-width: 400px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">📍 Add Location</h3>
          <button type="button" onclick="document.getElementById('advPostLocationModal').style.display='none'" 
                  style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
        </div>

        <input type="text" id="locationSearch" placeholder="Search location..." 
               style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 15px;">

        <div id="locationList" style="max-height: 300px; overflow-y: auto; border: 1px solid var(--border); border-radius: 6px;">
          <div style="padding: 20px; text-align: center; color: var(--text-muted);">Loading locations...</div>
        </div>

        <div style="margin-top: 15px; display: flex; gap: 10px;">
          <button type="button" onclick="AdvancedPost.useCurrentLocation()" 
                  class="btn btn--primary" style="flex: 1;">📡 Use Current Location</button>
          <button type="button" onclick="document.getElementById('advPostLocationModal').style.display='none'" 
                  class="btn btn--secondary" style="flex: 1;">Cancel</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';

    this.populateLocationList();

    // Search functionality
    document.getElementById('locationSearch').addEventListener('input', (e) => {
      this.filterLocations(e.target.value);
    });
  },

  populateLocationList() {
    const list = document.getElementById('locationList');
    const recentLocations = [
      { name: 'New York, USA', lat: 40.7128, lng: -74.0060 },
      { name: 'Los Angeles, USA', lat: 34.0522, lng: -118.2437 },
      { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
      { name: 'Paris, France', lat: 48.8566, lng: 2.3522 },
      { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
    ];

    list.innerHTML = recentLocations.map(loc => `
      <div onclick="AdvancedPost.setLocation('${loc.name}', ${loc.lat}, ${loc.lng})" 
           style="padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: 0.2s;">
        <div style="font-weight: 500;">${loc.name}</div>
        <div style="font-size: 12px; color: var(--text-muted);">📍 ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</div>
      </div>
    `).join('');
  },

  filterLocations(query) {
    // Simplified filtering
    const list = document.getElementById('locationList');
    const items = list.querySelectorAll('div[onclick]');
    items.forEach(item => {
      item.style.display = item.textContent.toLowerCase().includes(query.toLowerCase()) ? 'block' : 'none';
    });
  },

  useCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        this.setLocation(`Current Location`, latitude, longitude);
        document.getElementById('advPostLocationModal').style.display = 'none';
      },
      (error) => alert('Could not get your location: ' + error.message)
    );
  },

  setLocation(name, lat, lng) {
    this.state.location = { name, lat, lng };
    const locationBtn = document.getElementById('advPostLocationBtn');
    if (locationBtn) {
      locationBtn.textContent = `📍 ${name}`;
      locationBtn.style.backgroundColor = 'rgba(88, 86, 214, 0.1)';
    }
    document.getElementById('advPostLocationModal').style.display = 'none';
  },

  // ─────────────────────────────────────────────────────────────────────────
  // FEELING PICKER
  // ─────────────────────────────────────────────────────────────────────────
  openFeelingPicker() {
    this.showPickerModal('feeling');
  },

  // ─────────────────────────────────────────────────────────────────────────
  // ACTIVITY PICKER
  // ─────────────────────────────────────────────────────────────────────────
  openActivityPicker() {
    this.showPickerModal('activity');
  },

  showPickerModal(type) {
    const modal = document.getElementById('advPostPickerModal');
    if (!modal) return;

    const list = type === 'feeling' ? this.emojis.feelings : this.emojis.activities;
    const title = type === 'feeling' ? '😊 How are you feeling?' : '🎯 What are you doing?';

    modal.innerHTML = `
      <div class="modal-overlay-content" style="max-width: 500px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">${title}</h3>
          <button type="button" onclick="document.getElementById('advPostPickerModal').style.display='none'" 
                  style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">
          ${list.map((item, idx) => `
            <button type="button" onclick="AdvancedPost.setPicker('${type}', '${item}')"
                    style="padding: 12px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: 0.2s; font-size: 14px;">
              ${item}
            </button>
          `).join('')}
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  },

  setPicker(type, value) {
    if (type === 'feeling') {
      this.state.feeling = value;
      const btn = document.getElementById('advPostFeelingBtn');
      if (btn) {
        btn.textContent = value;
        btn.style.backgroundColor = 'rgba(88, 86, 214, 0.1)';
      }
    } else if (type === 'activity') {
      this.state.activity = value;
      const btn = document.getElementById('advPostActivityBtn');
      if (btn) {
        btn.textContent = value;
        btn.style.backgroundColor = 'rgba(88, 86, 214, 0.1)';
      }
    }
    document.getElementById('advPostPickerModal').style.display = 'none';
  },

  // ─────────────────────────────────────────────────────────────────────────
  // MENTIONS
  // ─────────────────────────────────────────────────────────────────────────
  showMentionSuggestions(query) {
    // This would be populated from users database
    const suggestions = [
      { id: '1', name: 'John Doe', avatar: '👤' },
      { id: '2', name: 'Jane Smith', avatar: '👩' },
      { id: '3', name: 'Mike Johnson', avatar: '👨' },
    ].filter(u => u.name.toLowerCase().includes(query.toLowerCase()));

    const suggestionBox = document.getElementById('advPostMentionSuggestions');
    if (suggestionBox && suggestions.length > 0) {
      suggestionBox.innerHTML = suggestions.map(user => `
        <div onclick="AdvancedPost.addMention('${user.id}', '${user.name}')" 
             style="padding: 8px; cursor: pointer; border-bottom: 1px solid var(--border);">
          ${user.avatar} ${user.name}
        </div>
      `).join('');
      suggestionBox.style.display = 'block';
    } else {
      suggestionBox.style.display = 'none';
    }
  },

  addMention(userId, userName) {
    if (!this.state.mentions.find(m => m.id === userId)) {
      this.state.mentions.push({ id: userId, name: userName });
      this.updateMentionsUI();
    }
  },

  openMentionsList() {
    const modal = document.getElementById('advPostMentionsModal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-overlay-content" style="max-width: 400px;">
        <h3 style="margin: 0 0 20px;">👥 Mentions</h3>
        <div id="mentionsList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; margin-bottom: 20px;">
          ${this.state.mentions.map(m => `
            <div onclick="AdvancedPost.removeMention('${m.id}')" 
                 style="padding: 8px; background: var(--primary-light); border-radius: 20px; text-align: center; cursor: pointer; font-size: 14px;">
              ${m.name} ✕
            </div>
          `).join('')}
        </div>
        <input type="text" id="mentionsSearch" placeholder="Search to add mentions..." 
               style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 15px;">
        <div id="mentionsSearchResults" style="max-height: 300px; overflow-y: auto;"></div>
        <button type="button" onclick="document.getElementById('advPostMentionsModal').style.display='none'" 
                class="btn btn--secondary" style="width: 100%; margin-top: 15px;">Done</button>
      </div>
    `;
    modal.style.display = 'flex';
  },

  updateMentionsUI() {
    // Update the mentions display
    const display = document.getElementById('advPostMentionsDisplay');
    if (display) {
      display.innerHTML = this.state.mentions.map(m => `<span class="tag">${m.name}</span>`).join('');
    }
  },

  removeMention(userId) {
    this.state.mentions = this.state.mentions.filter(m => m.id !== userId);
    this.updateMentionsUI();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // TAGS
  // ─────────────────────────────────────────────────────────────────────────
  openTagsList() {
    const modal = document.getElementById('advPostTagsModal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-overlay-content" style="max-width: 400px;">
        <h3 style="margin: 0 0 20px;">#️⃣ Tags</h3>
        <div id="tagsList" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
          ${this.state.tags.map(tag => `
            <div onclick="AdvancedPost.removeTag('${tag}')" 
                 style="padding: 6px 12px; background: var(--primary-light); border-radius: 20px; cursor: pointer; font-size: 14px;">
              #${tag} ✕
            </div>
          `).join('')}
        </div>
        <input type="text" id="tagsInput" placeholder="Add tags (press Enter)..." 
               style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 15px;">
        <div id="tagsSearchResults" style="max-height: 300px; overflow-y: auto;"></div>
        <button type="button" onclick="document.getElementById('advPostTagsModal').style.display='none'" 
                class="btn btn--secondary" style="width: 100%; margin-top: 15px;">Done</button>
      </div>
    `;
    modal.style.display = 'flex';

    document.getElementById('tagsInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const tag = e.target.value.trim().replace('#', '');
        if (tag && !this.state.tags.includes(tag)) {
          this.state.tags.push(tag);
          e.target.value = '';
          this.openTagsList(); // Refresh
        }
      }
    });
  },

  updateTagsUI() {
    // Update the tags display
    const display = document.getElementById('advPostTagsDisplay');
    if (display) {
      display.innerHTML = this.state.tags.map(tag => `<span class="tag">#${tag}</span>`).join('');
    }
  },

  removeTag(tag) {
    this.state.tags = this.state.tags.filter(t => t !== tag);
    this.updateTagsUI();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // HIGHLIGHTS
  // ─────────────────────────────────────────────────────────────────────────
  openHighlightsList() {
    const modal = document.getElementById('advPostHighlightsModal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-overlay-content" style="max-width: 500px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">⭐ Create/Add Highlights</h3>
          <button type="button" onclick="document.getElementById('advPostHighlightsModal').style.display='none'" 
                  style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 10px;">Selected Highlights:</h4>
          <div id="highlightsList" style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${this.state.highlights.map(h => `
              <div onclick="AdvancedPost.removeHighlight('${h.id}')" 
                   style="padding: 8px 12px; background: #FFD700; color: #333; border-radius: 20px; cursor: pointer; font-size: 14px;">
                ⭐ ${h.name} ✕
              </div>
            `).join('')}
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 12px; margin-bottom: 20px;">
          ${[
            { id: '1', name: 'Friends Only', icon: '👥' },
            { id: '2', name: 'Followers', icon: '⭐' },
            { id: '3', name: 'Best Friends', icon: '💕' },
            { id: '4', name: 'Family', icon: '👨‍👩‍👧‍👦' },
            { id: '5', name: 'Close Friends', icon: '🤝' },
            { id: '6', name: 'Dating Circle', icon: '💑' },
          ].map(h => `
            <button type="button" onclick="AdvancedPost.addHighlight('${h.id}', '${h.name}')"
                    style="padding: 12px; background: var(--card-bg); border: 2px solid ${this.state.highlights.find(x => x.id === h.id) ? 'var(--primary)' : 'var(--border)'}; border-radius: 8px; cursor: pointer; transition: 0.2s; font-size: 14px;">
              ${h.icon}<br>${h.name}
            </button>
          `).join('')}
        </div>

        <button type="button" onclick="document.getElementById('advPostHighlightsModal').style.display='none'" 
                class="btn btn--secondary" style="width: 100%;">Done</button>
      </div>
    `;
    modal.style.display = 'flex';
  },

  addHighlight(id, name) {
    if (!this.state.highlights.find(h => h.id === id)) {
      this.state.highlights.push({ id, name });
      this.openHighlightsList(); // Refresh
    }
  },

  removeHighlight(id) {
    this.state.highlights = this.state.highlights.filter(h => h.id !== id);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVACY SETTINGS
  // ─────────────────────────────────────────────────────────────────────────
  openPrivacySettings() {
    const modal = document.getElementById('advPostPrivacyModal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="modal-overlay-content" style="max-width: 500px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="margin: 0;">🔒 Privacy Settings</h3>
          <button type="button" onclick="document.getElementById('advPostPrivacyModal').style.display='none'" 
                  style="background: none; border: none; font-size: 24px; cursor: pointer;">✕</button>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 15px;">Who can see this post?</h4>
          
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="radio" name="privacy" value="public" 
                     ${this.state.privacySettings.sharedWith === 'public' ? 'checked' : ''}
                     onchange="AdvancedPost.setPrivacy('public')">
              <span>🌍 Public - Everyone</span>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="radio" name="privacy" value="followers" 
                     ${this.state.privacySettings.sharedWith === 'followers' ? 'checked' : ''}
                     onchange="AdvancedPost.setPrivacy('followers')">
              <span>⭐ Followers Only</span>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="radio" name="privacy" value="friends" 
                     ${this.state.privacySettings.sharedWith === 'friends' ? 'checked' : ''}
                     onchange="AdvancedPost.setPrivacy('friends')">
              <span>👥 Friends Only</span>
            </label>

            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
              <input type="radio" name="privacy" value="specific" 
                     ${this.state.privacySettings.sharedWith === 'specific' ? 'checked' : ''}
                     onchange="AdvancedPost.setPrivacy('specific')">
              <span>🎯 Specific People</span>
            </label>
          </div>
        </div>

        <div style="margin-bottom: 20px; padding: 15px; background: var(--primary-light); border-radius: 8px;">
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; margin-bottom: 10px;">
            <input type="checkbox" ${this.state.privacySettings.parallelize ? 'checked' : ''} 
                   onchange="AdvancedPost.state.privacySettings.parallelize = this.checked">
            <span>📡 Share in Parallel to Dating Sites</span>
          </label>
          <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
            <input type="checkbox" ${this.state.privacySettings.datingSiteShare ? 'checked' : ''} 
                   onchange="AdvancedPost.state.privacySettings.datingSiteShare = this.checked">
            <span>💑 Enable Interaction from Dating Users</span>
          </label>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 15px;">Hide from specific people:</h4>
          <input type="text" id="hideFromSearch" placeholder="Search people to hide from..." 
                 style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; margin-bottom: 10px;">
          <div id="hideFromList" style="max-height: 200px; overflow-y: auto;">
            ${this.state.privacySettings.hideFrom.map(person => `
              <div style="padding: 8px; background: var(--card-bg); border-radius: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span>${person}</span>
                <button type="button" onclick="AdvancedPost.removeHideFrom('${person}')" style="background: none; border: none; cursor: pointer; color: var(--danger);">✕</button>
              </div>
            `).join('')}
          </div>
        </div>

        <button type="button" onclick="document.getElementById('advPostPrivacyModal').style.display='none'" 
                class="btn btn--secondary" style="width: 100%;">Done</button>
      </div>
    `;
    modal.style.display = 'flex';
  },

  setPrivacy(setting) {
    this.state.privacySettings.sharedWith = setting;
  },

  removeHideFrom(person) {
    this.state.privacySettings.hideFrom = this.state.privacySettings.hideFrom.filter(p => p !== person);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // SUBMIT POST
  // ─────────────────────────────────────────────────────────────────────────
  async submitPost() {
    if (!this.state.text.trim() && this.state.media.photos.length === 0 && 
        this.state.media.videos.length === 0 && this.state.media.audio.length === 0) {
      alert('Please add some content to post!');
      return;
    }

    const submitBtn = document.getElementById('advPostSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = '📤 Posting...';

    try {
      const postData = {
        text: this.state.text,
        media: this.state.media,
        location: this.state.location,
        feeling: this.state.feeling,
        activity: this.state.activity,
        tags: this.state.tags,
        mentions: this.state.mentions,
        highlights: this.state.highlights,
        privacySettings: this.state.privacySettings,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch('/api/posts/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sc_token')}`
        },
        body: JSON.stringify(postData)
      });

      if (!response.ok) throw new Error('Failed to post');

      const result = await response.json();
      console.log('✅ Post created:', result);

      // Show success message
      this.showNotification('✅ Post published successfully!', 'success');

      // Close modal and reset
      setTimeout(() => {
        this.closePostModal();
        this.resetState();
        // Reload feed
        if (window.loadFeed) window.loadFeed();
      }, 1000);
    } catch (err) {
      console.error('❌ Post error:', err);
      this.showNotification('❌ Failed to post: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Share ! It';
    }
  },

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--danger)' : 'var(--primary)'};
      color: white;
      border-radius: 6px;
      z-index: 10000;
      animation: slideInRight 0.3s ease both;
    `;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease both';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // DRAFT MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────
  saveDraft() {
    localStorage.setItem('advPostDraft', JSON.stringify(this.state));
    console.log('💾 Draft saved');
  },

  loadDraft() {
    const draft = localStorage.getItem('advPostDraft');
    if (draft) {
      const parsed = JSON.parse(draft);
      this.state = { ...this.state, ...parsed };
      const textArea = document.getElementById('advPostText');
      if (textArea) textArea.value = this.state.text;
      this.updateCharCount();
      this.updateMediaUI();
      
      // Restore feeling button state
      if (this.state.feeling) {
        const feelingBtn = document.getElementById('advPostFeelingBtn');
        if (feelingBtn) {
          feelingBtn.textContent = this.state.feeling;
          feelingBtn.style.backgroundColor = 'rgba(88, 86, 214, 0.1)';
        }
      }
      
      // Restore activity button state
      if (this.state.activity) {
        const activityBtn = document.getElementById('advPostActivityBtn');
        if (activityBtn) {
          activityBtn.textContent = this.state.activity;
          activityBtn.style.backgroundColor = 'rgba(88, 86, 214, 0.1)';
        }
      }
      
      // Restore location button state
      if (this.state.location) {
        const locationBtn = document.getElementById('advPostLocationBtn');
        if (locationBtn) {
          locationBtn.textContent = `📍 ${this.state.location.name}`;
          locationBtn.style.backgroundColor = 'rgba(88, 86, 214, 0.1)';
        }
      }
    }
  },

  resetState() {
    this.state = {
      text: '',
      media: { photos: [], videos: [], audio: [] },
      location: null,
      feeling: null,
      activity: null,
      tags: [],
      mentions: [],
      highlights: [],
      privacySettings: {
        sharedWith: 'public',
        specificUsers: [],
        parallelize: true,
        datingSiteShare: false,
        hideFrom: [],
      },
      reactions: { likes: [], comments: [], shares: [] },
    };
    const textArea = document.getElementById('advPostText');
    if (textArea) textArea.value = '';
    this.updateCharCount();
    this.updateMediaUI();
  },

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },
};

// Don't auto-initialize — the page will call AdvancedPost.init() explicitly
// after loading the modal HTML to ensure all DOM elements exist.
