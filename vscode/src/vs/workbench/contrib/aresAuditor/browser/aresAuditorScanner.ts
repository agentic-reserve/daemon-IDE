/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ILifecycleService } from '../../../services/lifecycle/common/lifecycle.js';
import { IWorkingCopy, IWorkingCopyService } from '../../../services/workingCopy/common/workingCopyService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { isEqual } from '../../../../base/common/uri.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';
// Local in-file IAresFinding to avoid coupling to the contrib surface in this baseline
export interface IAresFinding {
  severity: 'critical'|'high'|'medium'|'low';
  type: string;
  location: string;
  description: string;
  tool: string;
  fix?: string;
}

export interface IAresScanResult {
  findings: IAresFinding[];
  toolsUsed: string[];
  duration: number;
  timestamp?: string;
}

const ARES_API_URL = 'https://api.aressystem.dev';

export class AresAuditorScanner extends Disposable {

	private readonly debounceTimers = new Map<string, any>();

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@INotificationService private readonly notificationService: INotificationService,
		@ILogService private readonly logService: ILogService,
		@IWorkingCopyService private readonly workingCopyService: IWorkingCopyService,
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@IFileService private readonly fileService: IFileService,
		@IMarkerService private readonly markerService: IMarkerService,
	) {
		super();

		this.lifecycleService.when(3).then(() => {
			if (this.isEnabled() && this.isOnSaveEnabled()) {
				this.setupOnSaveListener();
			}
		});
	}

	private isEnabled(): boolean {
		return this.configurationService.getValue<boolean>('aresAuditor.enabled') ?? true;
	}

	private isOnSaveEnabled(): boolean {
		return this.configurationService.getValue<boolean>('aresAuditor.onSave') ?? true;
	}

	private getToolsConfig() {
		return {
			semgrep: this.configurationService.getValue<boolean>('aresAuditor.tools.semgrep') ?? true,
			trident: this.configurationService.getValue<boolean>('aresAuditor.tools.trident') ?? true,
			fuzzyAI: this.configurationService.getValue<boolean>('aresAuditor.tools.fuzzyAI') ?? true,
			whistleblower: this.configurationService.getValue<boolean>('aresAuditor.tools.whistleblower') ?? true,
			mcpInjection: this.configurationService.getValue<boolean>('aresAuditor.tools.mcpInjection') ?? true,
		};
	}

	private setupOnSaveListener(): void {
		this._register(
			this.workingCopyService.onDidSave(async (e: IWorkingCopy) => {
				if (!this.shouldScan(e.resource)) { return; }
				this.debouncedScan(e.resource.toString(), async () => {
					await this.scanFile(e.resource);
				});
			})
		);

		this.logService.info('[ARES Auditor] On-save scanning enabled');
	}

	private shouldScan(uri: URI): boolean {
		const ext = uri.path.split('.').pop()?.toLowerCase() ?? '';

		const scanPatterns = [
			'ts', 'tsx', 'js', 'jsx',
			'rs',
			'py',
			'json',
		];

		return scanPatterns.includes(ext);
	}

	private debouncedScan(key: string, fn: () => Promise<void>): void {
		const existing = this.debounceTimers.get(key);
		if (existing) {
			clearTimeout(existing);
		}

		const timer = setTimeout(async () => {
			this.debounceTimers.delete(key);
			try {
				await fn();
			} catch (error) {
				this.logService.error('[ARES Auditor] Debounced scan failed:', error);
			}
		}, 2000);

		this.debounceTimers.set(key, timer);
	}

	private async scanFile(uri: URI): Promise<void> {
		const tools = this.getToolsConfig();
		if (!tools.semgrep && !tools.fuzzyAI && !tools.whistleblower) {
			return;
		}

		const ext = uri.path.split('.').pop()?.toLowerCase() ?? '';

		this.logService.info('[ARES Auditor] Scanning file:', uri.toString());

		try {
			const content = await this.fileService.readFile(uri);
			const contentStr = content.value.toString();

			let findings: IAresFinding[] = [];

			if (tools.semgrep && ['ts', 'tsx', 'js', 'jsx', 'rs', 'py'].includes(ext)) {
				findings = await this.runSemgrep(uri, contentStr);
			}

			if (tools.fuzzyAI && ['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
				const aiFindings = await this.runFuzzyAI(uri, contentStr);
				findings = [...findings, ...aiFindings];
			}

			if (tools.whistleblower && this.isAgentCode(uri)) {
				const promptFindings = await this.runWhistleblower(uri, contentStr);
				findings = [...findings, ...promptFindings];
			}

			if (findings.length > 0) {
				this.reportFindings(uri, findings);
			}
		} catch (error) {
			this.logService.error('[ARES Auditor] Scan failed for', uri.toString(), error);
		}
	}

	private isAgentCode(uri: URI): boolean {
		const path = uri.path.toLowerCase();
		return path.includes('/agent/') ||
			path.includes('/mcp/') ||
			path.includes('/chat/') ||
			path.includes('/prompt');
	}

	private async runSemgrep(uri: URI, content: string): Promise<IAresFinding[]> {
		try {
			const response = await fetch(`${ARES_API_URL}/api/semgrep/analyze`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					targets: [uri.toString()],
					rules: ['security'],
				}),
			});

			if (!response.ok) { return []; }

			const result = await response.json() as { findings?: IAresFinding[] };
			return result.findings ?? [];
		} catch {
			return [];
		}
	}

	private async runFuzzyAI(uri: URI, content: string): Promise<IAresFinding[]> {
		try {
			const response = await fetch(`${ARES_API_URL}/api/fuzzyai/fuzz`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					target: uri.toString(),
					attackTypes: ['prompt-injection', 'jailbreak'],
				}),
			});

			if (!response.ok) { return []; }

			const result = await response.json() as { findings?: IAresFinding[] };
			return result.findings ?? [];
		} catch {
			return [];
		}
	}

	private async runWhistleblower(uri: URI, content: string): Promise<IAresFinding[]> {
		try {
			const response = await fetch(`${ARES_API_URL}/api/whistleblower/extract`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					target: uri.toString(),
				}),
			});

			if (!response.ok) { return []; }

			const result = await response.json() as { findings?: IAresFinding[] };
			return result.findings ?? [];
		} catch {
			return [];
		}
	}

	private reportFindings(uri: URI, findings: IAresFinding[]): void {
		const critical = findings.filter(f => f.severity === 'critical').length;
		const high = findings.filter(f => f.severity === 'high').length;
		const medium = findings.filter(f => f.severity === 'medium').length;

		if (critical > 0) {
			this.notificationService.notify({
				severity: Severity.Error,
				message: `🔴 ARES found ${critical} critical security issue${critical > 1 ? 's' : ''} in ${uri.path.split('/').pop()}`,
			});
		} else if (high > 0) {
			this.notificationService.notify({
				severity: Severity.Warning,
				message: `🟠 ARES found ${high} high-risk security issue${high > 1 ? 's' : ''} in ${uri.path.split('/').pop()}`,
			});
		}

		this.logService.warn('[ARES Auditor] Findings:', {
			file: uri.toString(),
			findings: findings.map(f => ({ severity: f.severity, type: f.type, location: f.location })),
		});
	}
}
