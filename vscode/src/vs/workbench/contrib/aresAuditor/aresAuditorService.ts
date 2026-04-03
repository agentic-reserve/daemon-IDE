// Baseline stubbed ARES Auditor service for Route B
export class AresAuditorServiceStub {
  scanWorkspace(): Promise<void> { return Promise.resolve(); }
  scanFile(_uri: string): Promise<void> { return Promise.resolve(); }
  checkHealth(): Promise<boolean> { return new Promise(resolve => setTimeout(() => resolve(true), 300)); }
}
