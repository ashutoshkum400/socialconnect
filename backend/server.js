#!/usr/bin/env node
// Render's start command is configured as "backend/server.js".
// This shim boots the real backend (root server.js). The app's paths resolve
// relative to server.js itself, so nothing else changes.
require('../server.js');
