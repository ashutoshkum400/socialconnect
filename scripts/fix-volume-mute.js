// Fix: Save previous volume level before muting, restore on unmute
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'video.html');
let content = fs.readFileSync(filePath, 'utf8');

// Find toggleSystemMute function and replace it
const oldRegex = /      function toggleSystemMute\(\) \{\s+isSystemMuted = !isSystemMuted;\s+updateVolPopupMuteBtn\(\);\s+if \(isSystemMuted\) \{\s+\/\/ Set volume to 1% \(near-mute\)\s+var slider = document\.getElementById\('volPopupSlider'\);\s+if \(slider\) \{\s+slider\.value = '1';\s+setSystemVolume\(1\);\s+\}\s+\/\/ Also mute YouTube player\s+if \(!isMuted\) \{\s+isMuted = true;\s+updateMuteUI\(\);\s+var muteToggle = document\.getElementById\('muteToggle'\);\s+if \(muteToggle\) muteToggle\.checked = true;\s+\}\s+\} else \{\s+\/\/ Restore previous level\s+var slider = document\.getElementById\('volPopupSlider'\);\s+if \(slider\) \{\s+slider\.value = systemVolumeLevel;\s+setSystemVolume\(systemVolumeLevel\);\s+\}\s+\}\s+\}/;

const newFunc = `      var _prevVolumeBeforeMute = null;

      function toggleSystemMute() {
        isSystemMuted = !isSystemMuted;
        updateVolPopupMuteBtn();

        if (isSystemMuted) {
          // Save current level before muting
          _prevVolumeBeforeMute = systemVolumeLevel;
          // Set volume to 1% (near-mute)
          var slider = document.getElementById('volPopupSlider');
          if (slider) {
            slider.value = '1';
            setSystemVolume(1);
          }
          // Also mute YouTube player
          if (!isMuted) {
            isMuted = true;
            updateMuteUI();
            var muteToggle = document.getElementById('muteToggle');
            if (muteToggle) muteToggle.checked = true;
          }
        } else {
          // Restore previous level (before mute)
          var restoreLevel = _prevVolumeBeforeMute || 70;
          _prevVolumeBeforeMute = null;
          var slider = document.getElementById('volPopupSlider');
          if (slider) {
            slider.value = restoreLevel;
            setSystemVolume(restoreLevel);
          }
        }
      }`;

if (oldRegex.test(content)) {
  content = content.replace(oldRegex, newFunc);
  fs.writeFileSync(filePath, content);
  console.log('✅ Fixed toggleSystemMute - previous volume level is now saved before muting');
} else {
  console.log('❌ Could not find toggleSystemMute function to replace');
  // Debug: find the function
  const idx = content.indexOf('function toggleSystemMute()');
  if (idx >= 0) {
    const snippet = content.substring(idx, idx + 600);
    console.log('Found at index:', idx);
    console.log('Snippet:');
    console.log(JSON.stringify(snippet));
  } else {
    console.log('Function not found at all!');
  }
}
