// Helper: kill any process listening on port 3000 (Windows)
const cp = require('child_process');

try {
  const out = cp.execSync('netstat -ano', { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  const lines = out.split(/\r?\n/).filter(l => l.includes(':3000') && l.toUpperCase().includes('LISTENING'));
  const pids = new Set();
  lines.forEach(l => {
    const parts = l.trim().split(/\s+/);
    if (parts.length >= 5) pids.add(parts[parts.length - 1]);
  });
  console.log('PIDs listening on :3000:', [...pids]);
  pids.forEach(p => {
    try {
      cp.execSync('taskkill /PID ' + p + ' /F', { stdio: 'pipe' });
      console.log('Killed PID', p);
    } catch (e) {
      console.log('Failed to kill PID', p, e.message);
    }
  });
  if (pids.size === 0) console.log('No process listening on port 3000.');
} catch (e) {
  console.error('Error:', e.message);
}

