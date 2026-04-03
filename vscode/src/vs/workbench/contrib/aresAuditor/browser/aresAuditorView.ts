// Lightweight stand-in view for ARES Auditor (standalone surface)
export function renderAresAuditorView(container: HTMLElement): void {
  container.innerHTML = `<div class="ares-auditor-view">
    <h3>ARES Security Auditor (standalone)</h3>
    <p>Use this surface to run security scans against your workspace.</p>
  </div>`;
}
