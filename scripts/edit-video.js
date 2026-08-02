// Helper script to add volume popup JS functions to video.html
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'video.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add volume popup functions after toggleSettings and before setPref
const searchStr = '      function toggleSettings() {\n        settingsOpen = !settingsOpen;\n        document.getElementById(\'settingsPanel\')?.classList.toggle(\'open\', settingsOpen);\n        document.getElementById(\'settingsOverlay\')?.classList.toggle(\'open\', settingsOpen);\n        if (settingsOpen) updateSettingsUI();\n      }\n\n      function setPref(key, value) {';

const replaceStr = '      function toggleSettings() {\n        settingsOpen = !settingsOpen;\n        document.getElementById(\'settingsPanel\')?.classList.toggle(\'open\', settingsOpen);\n        document.getElementById(\'settingsOverlay\')?.classList.toggle(\'open\', settingsOpen);\n        if (settingsOpen) updateSettingsUI();\n      }\n\n      // ─── Volume Popup ────────────────────────────────────────────\n      var volPopupOpen = false;\n      var systemVolumeLevel = 70;\n      var isSystemMuted = false;\n\n      function toggleVolumePopup() {\n        volPopupOpen = !volPopupOpen;\n        var popup = document.getElementById(\'volPopup\');\n        if (!popup) return;\n        popup.classList.toggle(\'open\', volPopupOpen);\n        if (volPopupOpen) {\n          var slider = document.getElementById(\'volPopupSlider\');\n          var label = document.getElementById(\'volPopupLabel\');\n          if (slider) {\n            slider.value = systemVolumeLevel;\n            if (label) label.textContent = systemVolumeLevel + \'%\';\n          }\n          updateVolPopupMuteBtn();\n        }\n      }\n\n      function setSystemVolume(val) {\n        var level = parseInt(val);\n        if (isNaN(level) || level < 1 || level > 100) return;\n        systemVolumeLevel = level;\n        isSystemMuted = false;\n\n        var label = document.getElementById(\'volPopupLabel\');\n        if (label) label.textContent = level + \'%\';\n        updateVolPopupMuteBtn();\n\n        // Sync settings panel volume slider (1-100 -> 0-1)\n        var volSlider = document.getElementById(\'volumeSlider\');\n        if (volSlider) {\n          var normalized = level / 100;\n          volSlider.value = normalized;\n          var volLabel = document.getElementById(\'volumeLabel\');\n          if (volLabel) volLabel.textContent = Math.round(normalized * 100) + \'%\';\n        }\n\n        // Unmute YouTube player if muted\n        if (hasInteracted && isMuted) {\n          isMuted = false;\n          updateMuteUI();\n        }\n\n        // Send to server to control Windows system volume\n        fetch(\'/api/system-volume\', {\n          method: \'POST\',\n          headers: { \'Content-Type\': \'application/json\' },\n          body: JSON.stringify({ level: level })\n        }).catch(function(err) {\n          console.error(\'System volume control failed:\', err);\n        });\n      }\n\n      function toggleSystemMute() {\n        isSystemMuted = !isSystemMuted;\n        updateVolPopupMuteBtn();\n\n        if (isSystemMuted) {\n          // Set volume to 1% (near-mute)\n          var slider = document.getElementById(\'volPopupSlider\');\n          if (slider) {\n            slider.value = \'1\';\n            setSystemVolume(1);\n          }\n          // Also mute YouTube player\n          if (!isMuted) {\n            isMuted = true;\n            updateMuteUI();\n            var muteToggle = document.getElementById(\'muteToggle\');\n            if (muteToggle) muteToggle.checked = true;\n          }\n        } else {\n          // Restore previous level\n          var slider = document.getElementById(\'volPopupSlider\');\n          if (slider) {\n            slider.value = systemVolumeLevel;\n            setSystemVolume(systemVolumeLevel);\n          }\n        }\n      }\n\n      function updateVolPopupMuteBtn() {\n        var btn = document.getElementById(\'volPopupMuteBtn\');\n        if (!btn) return;\n        if (isSystemMuted || systemVolumeLevel <= 5) {\n          btn.textContent = \'🔊 Unmute\';\n          btn.classList.add(\'muted\');\n        } else {\n          btn.textContent = \'🔇 Mute\';\n          btn.classList.remove(\'muted\');\n        }\n      }\n\n      function setPref(key, value) {';

if (content.includes(searchStr)) {
  content = content.replace(searchStr, replaceStr);
  console.log('Added volume popup functions: true');
} else {
  console.log('ERROR: Could not find toggleSettings/setPref pattern');
  // Try to find it with different whitespace
  const idx = content.indexOf('function setPref(key, value) {');
  console.log('setPref found at index:', idx);
  if (idx >= 0) {
    const before = content.substring(idx - 200, idx);
    console.log('Context before setPref:');
    console.log(JSON.stringify(before));
  }
}

// 2. Add methods to return statement (before setVolume, at the end)
const returnSearch = '        setVolume,\n      };\n    })();';
const returnReplace = '        setVolume,\n        toggleVolumePopup,\n        setSystemVolume,\n        toggleSystemMute,\n      };\n    })();';

if (content.includes(returnSearch)) {
  content = content.replace(returnSearch, returnReplace);
  console.log('Added methods to return statement: true');
} else {
  console.log('ERROR: Could not find return statement pattern');
  const idx = content.indexOf('      };\n    })();');
  console.log('Return end found at index:', idx);
  if (idx >= 0) {
    const before = content.substring(idx - 100, idx + 20);
    console.log('Context around return end:');
    console.log(JSON.stringify(before));
  }
}

fs.writeFileSync(filePath, content);
console.log('video.html updated successfully');
console.log('File size:', content.length, 'chars');
