import api from '../api.js';
import showToast from '../components/toast.js';

export function renderDiagnostics(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Chaos & SRE Diagnostics Console</h1>
        <p class="page-subtitle">Inject synthetic failures and load to validate Prometheus alerts, Grafana dashboards, and auto-healing</p>
      </div>
    </div>

    <!-- Alert / Caution Warning -->
    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 1rem 1.25rem; border-radius: var(--radius-md); margin-bottom: 2rem;">
      <strong style="color: var(--accent-danger);">DevOps Practical Notice:</strong>
      <p style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 0.25rem;">
        These endpoints simulate real production incidents (CPU lockups, V8 memory leaks, and process crashes).
        Use them to evaluate Kubernetes pod restart policies, Prometheus high-CPU alerts, and OOMKill detectors.
      </p>
    </div>

    <div class="grid-2">
      <!-- Chaos 1: CPU Stress -->
      <div class="card">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <h3 style="font-size: 1.15rem;">CPU Stress Injection</h3>
          <span class="badge badge-warning">High CPU</span>
        </div>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          Locks the Node.js event loop with compute-intensive cryptographic hashing for a specified duration.
          Validates Prometheus <code>process_cpu_seconds_total</code> metric spikes.
        </p>
        <div class="form-group">
          <label class="form-label">Duration (milliseconds)</label>
          <input type="number" id="cpu-duration-input" class="form-control" value="2500" min="500" max="10000" step="500" />
        </div>
        <button id="btn-trigger-cpu" class="btn btn-warning" style="width: 100%;">
          ⚡ Trigger CPU Stress
        </button>
      </div>

      <!-- Chaos 2: Memory Leak -->
      <div class="card">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <h3 style="font-size: 1.15rem;">Memory Leak Simulation</h3>
          <span class="badge badge-warning">V8 Heap Leak</span>
        </div>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          Allocates unbounded arrays into global memory without garbage collection.
          Tests Prometheus <code>nodejs_heap_size_used_bytes</code> and container memory limits.
        </p>
        <div class="form-group">
          <label class="form-label">Leak Size (Megabytes)</label>
          <input type="number" id="mem-size-input" class="form-control" value="50" min="10" max="300" step="10" />
        </div>
        <button id="btn-trigger-mem" class="btn btn-warning" style="width: 100%;">
          💧 Inject Memory Leak
        </button>
      </div>
    </div>

    <!-- Chaos 3: Immediate Crash & Observability Links -->
    <div class="grid-2" style="margin-top: 1.5rem;">
      <div class="card" style="border-color: rgba(239, 68, 68, 0.4);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <h3 style="font-size: 1.15rem; color: var(--accent-danger);">Fatal Process Crash</h3>
          <span class="badge badge-failed">Process.exit(1)</span>
        </div>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
          Immediately executes <code>process.exit(1)</code>. Tests Docker container restart policies
          (e.g. <code>--restart unless-stopped</code>) or Kubernetes Pod crash loops.
        </p>
        <button id="btn-trigger-crash" class="btn btn-danger" style="width: 100%;">
          💥 Crash Server Process
        </button>
      </div>

      <div class="card">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
          <h3 style="font-size: 1.15rem;">Telemetry & Metrics Links</h3>
          <span class="badge badge-confirmed">Prometheus</span>
        </div>
        <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.25rem;">
          Inspect raw metrics formatted for Prometheus scraping:
        </p>
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <a href="/metrics" target="_blank" class="btn btn-outline" style="justify-content: flex-start;">
            📊 View Raw Prometheus Metrics (/metrics) &nearr;
          </a>
          <a href="/healthz/live" target="_blank" class="btn btn-outline" style="justify-content: flex-start;">
            💓 View Liveness Probe (/healthz/live) &nearr;
          </a>
          <a href="/healthz/ready" target="_blank" class="btn btn-outline" style="justify-content: flex-start;">
            🩺 View Readiness Probe (/healthz/ready) &nearr;
          </a>
        </div>
      </div>
    </div>

    <!-- Live Execution Logs Output -->
    <div class="card" style="margin-top: 2rem;">
      <h3 style="margin-bottom: 0.75rem; font-size: 1.05rem;">Diagnostic Response Log</h3>
      <pre id="diag-output" style="background: rgba(0,0,0,0.5); padding: 1rem; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 0.85rem; color: #a7f3d0; max-height: 250px; overflow-y: auto;">Awaiting chaos trigger...</pre>
    </div>
  `;

  setupChaosTriggers();
}

function setupChaosTriggers() {
  const output = document.getElementById('diag-output');

  const logResult = (action, res) => {
    if (output) {
      output.textContent = `[${new Date().toISOString()}] Action: ${action}\n` + JSON.stringify(res, null, 2);
    }
  };

  // CPU Stress Trigger
  const cpuBtn = document.getElementById('btn-trigger-cpu');
  cpuBtn?.addEventListener('click', async () => {
    const durationMs = parseInt(document.getElementById('cpu-duration-input')?.value || '2000', 10);
    cpuBtn.disabled = true;
    cpuBtn.textContent = 'Executing CPU Stress...';
    showToast(`Injecting CPU load for ${durationMs}ms...`, 'info');

    try {
      const res = await api.triggerCpuStress(durationMs);
      logResult('CPU_STRESS', res);
      showToast(`CPU Stress completed (${res.iterations} iterations)`, 'success');
    } catch (err) {
      logResult('CPU_STRESS_ERROR', { error: err.message });
      showToast(`CPU Stress failed: ${err.message}`, 'error');
    } finally {
      cpuBtn.disabled = false;
      cpuBtn.textContent = '⚡ Trigger CPU Stress';
    }
  });

  // Memory Leak Trigger
  const memBtn = document.getElementById('btn-trigger-mem');
  memBtn?.addEventListener('click', async () => {
    const sizeMb = parseInt(document.getElementById('mem-size-input')?.value || '50', 10);
    memBtn.disabled = true;
    memBtn.textContent = 'Allocating Heap...';
    showToast(`Leaking ~${sizeMb}MB into heap...`, 'info');

    try {
      const res = await api.triggerMemoryLeak(sizeMb);
      logResult('MEMORY_LEAK', res);
      showToast(`Memory allocated! Heap: ${res.heapUsedMb}MB`, 'warning');
    } catch (err) {
      logResult('MEMORY_LEAK_ERROR', { error: err.message });
      showToast(`Memory leak failed: ${err.message}`, 'error');
    } finally {
      memBtn.disabled = false;
      memBtn.textContent = '💧 Inject Memory Leak';
    }
  });

  // Crash Trigger
  const crashBtn = document.getElementById('btn-trigger-crash');
  crashBtn?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to crash the server process? This will terminate the Node.js process with code 1.')) {
      return;
    }

    crashBtn.disabled = true;
    crashBtn.textContent = 'Crashing Process...';
    showToast('Sending crash command to server...', 'error');

    try {
      const res = await api.triggerCrash();
      logResult('PROCESS_CRASH', res);
      showToast('Process crash signal sent! Server is exiting.', 'error');
    } catch (err) {
      logResult('CRASH_RESPONSE', { error: err.message });
    }
  });
}

export default renderDiagnostics;
