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
        avatarEl.src = this.currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(this.currentUser.name || 'User')}&background=1877f2&color=fff&size=40`;
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
      
      // Update privacy badge
      this.updatePrivacyBadge();
      
      modal.style.display = 'flex';
      modal.style.opacity = '0';
      setTimeout(() => modal.style.opacity = '1', 10);
      this.loadDraft();
    }
  },

  updatePrivacyBadge() {
    const badge = document.getElementById('advPostPrivacyBadge');
    if (!badge) return;
    const settings = {
      'public': { icon: '🌍', label: 'Public' },
      'followers': { icon: '⭐', label: 'Followers' },
      'friends': { icon: '👥', label: 'Friends' },
      'specific': { icon: '🎯', label: 'Specific' },
    };
    const s = settings[this.state.privacySettings.sharedWith] || settings['public'];
    badge.textContent = `${s.icon} ${s.label}`;
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
  async handlePhotoUpload(event) {
    const files = Array.from(event.target.files || []);
    const photoFiles = files.filter(f => f.type.startsWith('image/'));
    for (const file of photoFiles) {
      await this.addMediaFile(file, 'photo');
    }
    this.updateMediaUI();
    event.target.value = '';
  },

  async handleVideoUpload(event) {
    const files = Array.from(event.target.files || []);
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    for (const file of videoFiles) {
      await this.addMediaFile(file, 'video');
    }
    this.updateMediaUI();
    event.target.value = '';
  },

  async handleAudioUpload(event) {
    const files = Array.from(event.target.files || []);
    const audioFiles = files.filter(f => f.type.startsWith('audio/'));
    for (const file of audioFiles) {
      await this.addMediaFile(file, 'audio');
    }
    this.updateMediaUI();
    event.target.value = '';
  },

  async handleDroppedFiles(files) {
    const fileArray = Array.from(files);
    for (const file of fileArray) {
      if (file.type.startsWith('image/')) {
        await this.addMediaFile(file, 'photo');
      } else if (file.type.startsWith('video/')) {
        await this.addMediaFile(file, 'video');
      } else if (file.type.startsWith('audio/')) {
        await this.addMediaFile(file, 'audio');
      }
    }
    this.updateMediaUI();
  },

  showUploadProgress(fileName, fileType) {
    const container = document.getElementById('advPostUploadItems');
    const progressId = `upload_${this.generateId()}`;
    
    const progressHTML = `
      <div id="${progressId}" style="padding: 10px; background: var(--input-bg); border-radius: 6px; border: 1px solid var(--border);">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="font-size: 16px;">${fileType === 'photo' ? '📷' : fileType === 'video' ? '🎬' : '🎵'}</span>
          <span style="font-size: 13px; flex: 1; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</span>
          <span id="${progressId}_percent" style="font-size: 12px; color: var(--text-muted); min-width: 40px; text-align: right;">0%</span>
        </div>
        <div style="width: 100%; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden;">
          <div id="${progressId}_bar" style="height: 100%; background: var(--primary); width: 0%; transition: width 0.2s ease; border-radius: 2px;"></div>
        </div>
      </div>
    `;
    
    container.innerHTML += progressHTML;
    document.getElementById('advPostUploadProgress').style.display = 'flex';
    
    return progressId;
  },

  updateUploadProgress(progressId, percentage) {
    const bar = document.getElementById(`${progressId}_bar`);
    const percentEl = document.getElementById(`${progressId}_percent`);
    if (bar) {
      bar.style.width = percentage + '%';
      percentEl.textContent = Math.round(percentage) + '%';
    }
  },

  completeUpload(progressId) {
    const progressItem = document.getElementById(progressId);
    if (progressItem) {
      setTimeout(() => {
        progressItem.style.opacity = '0';
        progressItem.style.transition = 'opacity 0.3s ease';
        setTimeout(() => progressItem.remove(), 300);
        
        // Hide container if no more uploads
        const container = document.getElementById('advPostUploadItems');
        if (!container.children.length) {
          document.getElementById('advPostUploadProgress').style.display = 'none';
        }
      }, 500);
    }
  },

  addMediaFile(file, type) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      const progressId = this.showUploadProgress(file.name, type);
      
      reader.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100;
          this.updateUploadProgress(progressId, percentComplete);
        }
      };

      reader.onload = async (e) => {
        let data = e.target.result;
        let thumbnail = null;

        // Compress images to reduce payload size
        if (type === 'photo' && data.length > 500 * 1024) {
          try {
            this.updateUploadProgress(progressId, 95);
            data = await this.compressImage(data, 0.7);
          } catch (err) {
            console.warn('Image compression failed, using original:', err);
          }
        } else if (type === 'photo') {
          this.updateUploadProgress(progressId, 90);
          thumbnail = data;
        }

        const mediaItem = {
          id: this.generateId(),
          type: type,
          name: file.name,
          size: data.length,
          data: data,
          thumbnail: thumbnail,
          duration: null,
        };

        if (type === 'photo') {
          this.state.media.photos.push(mediaItem);
        } else if (type === 'video') {
          this.state.media.videos.push(mediaItem);
        } else if (type === 'audio') {
          this.state.media.audio.push(mediaItem);
        }

        this.updateUploadProgress(progressId, 100);
        this.completeUpload(progressId);
        resolve();
      };
      reader.onerror = () => {
        this.completeUpload(progressId);
        resolve();
      };
      reader.readAsDataURL(file);
    });
  },

  compressImage(dataUrl, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        // Max dimension 1920px
        const MAX_DIM = 1920;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round(height * MAX_DIM / width);
            width = MAX_DIM;
          } else {
            width = Math.round(width * MAX_DIM / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = dataUrl;
    });
  },

  updateMediaUI() {
    const container = document.getElementById('advPostMediaContainer');
    if (!container) return;

    let html = '';

    // Photos
    this.state.media.photos.forEach((photo, idx) => {
      html += `
        <div class="media-item" data-id="${photo.id}" title="${photo.name}">
          <img src="${photo.thumbnail || photo.data}" alt="Photo ${idx + 1}" class="media-thumbnail" loading="lazy">
          <div class="media-overlay">
            <span class="media-badge">📷</span>
          </div>
          <button type="button" class="media-remove" onclick="AdvancedPost.removeMedia('${photo.id}', 'photo');event.stopPropagation();">
            <span>✕</span>
          </button>
        </div>
      `;
    });

    // Videos
    this.state.media.videos.forEach((video, idx) => {
      html += `
        <div class="media-item video-item" data-id="${video.id}" title="${video.name}">
          <video src="${video.data}" class="media-thumbnail" muted preload="metadata"></video>
          <div class="media-overlay">
            <span class="media-play-icon">▶</span>
            <span class="media-badge">🎬</span>
          </div>
          <button type="button" class="media-remove" onclick="AdvancedPost.removeMedia('${video.id}', 'video');event.stopPropagation();">
            <span>✕</span>
          </button>
        </div>
      `;
    });

    // Audio
    this.state.media.audio.forEach((audio, idx) => {
      html += `
        <div class="media-item audio-item" data-id="${audio.id}" title="${audio.name}">
          <div class="media-placeholder">
            <div class="audio-wave">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="media-label">${audio.name}</div>
          </div>
          <button type="button" class="media-remove" onclick="AdvancedPost.removeMedia('${audio.id}', 'audio');event.stopPropagation();">
            <span>✕</span>
          </button>
        </div>
      `;
    });

    container.innerHTML = html;
    container.style.display = html ? 'grid' : 'none';
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
    this.allLocations = [
      { name: 'New York, USA', lat: 40.7128, lng: -74.0060 },
      { name: 'Los Angeles, USA', lat: 34.0522, lng: -118.2437 },
      { name: 'Chicago, USA', lat: 41.8781, lng: -87.6298 },
      { name: 'San Francisco, USA', lat: 37.7749, lng: -122.4194 },
      { name: 'Miami, USA', lat: 25.7617, lng: -80.1918 },
      { name: 'Seattle, USA', lat: 47.6062, lng: -122.3321 },
      { name: 'Boston, USA', lat: 42.3601, lng: -71.0589 },
      { name: 'Austin, USA', lat: 30.2672, lng: -97.7431 },
      { name: 'Denver, USA', lat: 39.7392, lng: -104.9903 },
      { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
      { name: 'Paris, France', lat: 48.8566, lng: 2.3522 },
      { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
      { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093 },
      { name: 'Dubai, UAE', lat: 25.2048, lng: 55.2708 },
      { name: 'Mumbai, India', lat: 19.0760, lng: 72.8777 },
      { name: 'Barcelona, Spain', lat: 41.3874, lng: 2.1686 },
      { name: 'Berlin, Germany', lat: 52.5200, lng: 13.4050 },
      { name: 'Toronto, Canada', lat: 43.6532, lng: -79.3832 },
      { name: 'São Paulo, Brazil', lat: -23.5505, lng: -46.6333 },
      { name: 'Cape Town, South Africa', lat: -33.9249, lng: 18.4241 },
    ];

    list.innerHTML = this.allLocations.map(loc => `
      <div onclick="AdvancedPost.setLocation('${loc.name.replace(/'/g, "\\'")}', ${loc.lat}, ${loc.lng})" 
           class="location-item"
           style="padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: 0.2s;">
        <div style="font-weight: 500;">📍 ${loc.name}</div>
        <div style="font-size: 12px; color: var(--text-muted);">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</div>
      </div>
    `).join('');
  },

  filterLocations(query) {
    const list = document.getElementById('locationList');
    const q = query.toLowerCase().trim();
    if (!q) {
      // Reset to show all
      this.populateLocationList();
      return;
    }
    const filtered = this.allLocations.filter(loc =>
      loc.name.toLowerCase().includes(q)
    );
    list.innerHTML = filtered.length > 0
      ? filtered.map(loc => `
          <div onclick="AdvancedPost.setLocation('${loc.name.replace(/'/g, "\\'")}', ${loc.lat}, ${loc.lng})" 
               class="location-item"
               style="padding: 12px; border-bottom: 1px solid var(--border); cursor: pointer; transition: 0.2s;">
            <div style="font-weight: 500;">📍 ${loc.name}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</div>
          </div>
        `).join('')
      : `<div style="padding: 20px; text-align: center; color: var(--text-muted);">No locations found for "${q}"</div>`;
  },

  useCurrentLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // Get location name from coordinates using reverse geocoding
        const locationName = await this.reverseGeocode(latitude, longitude);
        this.setLocation(locationName || `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`, latitude, longitude);
        document.getElementById('advPostLocationModal').style.display = 'none';
      },
      (error) => alert('Could not get your location: ' + error.message)
    );
  },

  async reverseGeocode(latitude, longitude) {
    try {
      // Use Nominatim API (OpenStreetMap) for reverse geocoding - free and no API key needed
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'SocialConnect-App'
          }
        }
      );
      
      if (!response.ok) throw new Error('Reverse geocoding failed');
      
      const data = await response.json();
      
      if (data.address) {
        // Try to construct a human-readable location name
        const address = data.address;
        const locationName = address.city || address.town || address.village || address.suburb || 
                            address.county || address.state || address.country || 
                            `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        return locationName;
      }
      
      return null;
    } catch (err) {
      console.warn('Reverse geocoding error:', err);
      return null; // Return null to fall back to coordinate display
    }
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
    // Fetch real users from the API
    const suggestionBox = document.getElementById('advPostMentionSuggestions');
    if (!suggestionBox) return;

    if (!query || query.length < 1) {
      suggestionBox.style.display = 'none';
      return;
    }

    fetch(`/api/users?q=${encodeURIComponent(query)}`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('sc_token')}` }
    })
      .then(r => r.json())
      .then(users => {
        const userList = Array.isArray(users) ? users : (users.data || []);
        const filtered = userList
          .filter(u => u.id !== (this.currentUser?.id))
          .slice(0, 10);

        if (filtered.length > 0) {
          suggestionBox.innerHTML = filtered.map(user => `
            <div onclick="AdvancedPost.addMention('${user.id}', '${user.name.replace(/'/g, "\\'")}')" 
                 style="display:flex;align-items:center;gap:8px;padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);transition:0.2s;">
              <img src="${user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff&size=32`}" 
                   style="width:32px;height:32px;border-radius:50%;object-fit:cover;" 
                   onerror="this.style.display='none'">
              <div>
                <div style="font-weight:500;">${user.name}</div>
                <div style="font-size:12px;color:var(--text-muted);">@${user.username || ''}</div>
              </div>
            </div>
          `).join('');
          suggestionBox.style.display = 'block';
        } else {
          suggestionBox.style.display = 'none';
        }
      })
      .catch(() => {
        suggestionBox.style.display = 'none';
      });
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
    this.updatePrivacyBadge();
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
    const progressContainer = document.getElementById('advPostSubmitProgress');
    const progressBar = document.getElementById('advPostSubmitBar');
    const progressPercent = document.getElementById('advPostSubmitPercent');
    
    submitBtn.disabled = true;
    submitBtn.textContent = '📤 Posting...';
    progressContainer.style.display = 'flex';

    try {
      // Update progress: 10% - validation complete
      this.updateProgressBar(10);

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

      // Update progress: 30% - data prepared
      this.updateProgressBar(30);

      // Simulate upload progress
      const uploadInterval = setInterval(() => {
        const currentWidth = parseFloat(progressBar.style.width);
        if (currentWidth < 90) {
          this.updateProgressBar(currentWidth + Math.random() * 20);
        }
      }, 300);

      const response = await fetch('/api/posts/advanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sc_token')}`
        },
        body: JSON.stringify(postData)
      });

      clearInterval(uploadInterval);
      this.updateProgressBar(95);

      if (!response.ok) throw new Error('Failed to post');

      const result = await response.json();
      console.log('✅ Post created:', result);

      // Update progress: 100% - complete
      this.updateProgressBar(100);

      // Show comprehensive success notification
      this.showSuccessNotification(result.postId || result.post?.id);

      // Close modal and reset after delay
      setTimeout(() => {
        this.closePostModal();
        this.resetState();
        progressContainer.style.display = 'none';
        progressBar.style.width = '0%';
        progressPercent.textContent = '0%';
        // Reload feed
        if (window.loadFeed) window.loadFeed();
      }, 2000);
    } catch (err) {
      console.error('❌ Post error:', err);
      clearInterval(uploadInterval);
      progressContainer.style.display = 'none';
      this.showErrorNotification('❌ Failed to post: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Share ! It';
    }
  },

  updateProgressBar(percentage) {
    const bar = document.getElementById('advPostSubmitBar');
    const percentEl = document.getElementById('advPostSubmitPercent');
    if (bar) {
      percentage = Math.min(percentage, 100);
      bar.style.width = percentage + '%';
      percentEl.textContent = Math.round(percentage) + '%';
    }
  },

  showSuccessNotification(postId) {
    // Create full-screen success overlay
    const overlay = document.createElement('div');
    overlay.id = 'successNotificationOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      animation: fadeIn 0.3s ease both;
    `;

    const notificationBox = document.createElement('div');
    notificationBox.style.cssText = `
      background: white;
      border-radius: 16px;
      padding: 40px 30px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 400px;
      width: 90%;
      animation: slideUpFade 0.4s ease both;
    `;

    notificationBox.innerHTML = `
      <div style="font-size: 64px; margin-bottom: 20px; animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);">✅</div>
      <h2 style="margin: 0 0 10px; font-size: 24px; color: var(--text); font-weight: 700;">Post Published!</h2>
      <p style="margin: 0 0 20px; color: var(--text-muted); font-size: 14px;">Your post has been successfully shared with the community.</p>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button onclick="document.getElementById('successNotificationOverlay').remove()" style="padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; transition: 0.2s;">View Feed</button>
      </div>
    `;

    overlay.appendChild(notificationBox);
    document.body.appendChild(overlay);

    // Auto-close after 3 seconds
    setTimeout(() => {
      overlay.style.animation = 'fadeOut 0.3s ease both';
      setTimeout(() => {
        if (overlay.parentElement) overlay.remove();
      }, 300);
    }, 3000);
  },

  showErrorNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 16px 20px;
      background: #ff4757;
      color: white;
      border-radius: 8px;
      z-index: 10000;
      animation: slideInRight 0.3s ease both;
      box-shadow: 0 8px 16px rgba(255, 71, 87, 0.3);
      max-width: 300px;
      font-weight: 500;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease both';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
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
      this.updatePrivacyBadge();
      
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
