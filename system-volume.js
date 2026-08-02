// ─── System Volume Control (Windows) ────────────────────────────────────────
// Provides an API endpoint to set Windows OS master volume via PowerShell

const { exec } = require('child_process');
const { platform } = require('os');

/**
 * POST /api/system-volume
 * Body: { level: number } — 0 to 100 (0% to 100%)
 * Sets Windows system master volume using waveOutSetVolume via PowerShell.
 */
function registerSystemVolumeRoute(app) {
  app.post('/api/system-volume', (req, res) => {
    const { level } = req.body;
    if (level === undefined || typeof level !== 'number' || level < 1 || level > 100) {
      return res.status(400).json({ error: 'Level must be a number between 1 and 100' });
    }

    if (platform() !== 'win32') {
      return res.status(400).json({ error: 'System volume control only supported on Windows' });
    }

    // PowerShell script using winmm.dll waveOutSetVolume
    // Sets both left and right channels to the same level
    const psScript = [
      'Add-Type -TypeDefinition @"',
      'using System.Runtime.InteropServices;',
      'public class AudioVol {',
      '    [DllImport("winmm.dll")]',
      '    public static extern int waveOutSetVolume(System.IntPtr h, uint v);',
      '}',
      '"@;',
      `$v = [uint32]([math]::Round(${level} * 65535 / 100));`,
      '$full = ($v -shl 16) -bor $v;',
      '[AudioVol]::waveOutSetVolume([System.IntPtr]::Zero, $full);'
    ].join('\n');

    // Encode as UTF-16LE Base64 for PowerShell -EncodedCommand (avoids escaping issues)
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

    exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
      timeout: 10000,
      windowsHide: true
    }, (err, stdout, stderr) => {
      if (err) {
        console.error('System volume control error:', err.message);
        return res.status(500).json({ error: 'Failed to set system volume: ' + err.message });
      }
      res.json({ success: true, level });
    });
  });
}

module.exports = { registerSystemVolumeRoute };
