/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IMcpService } from '../../../contrib/mcp/common/mcpTypes.js';
import { MCP } from '../../../contrib/mcp/common/modelContextProtocol.js';
import { SolideAiSettingId } from './aiProvider.js';

export const IMcpToolRouter = createDecorator<IMcpToolRouter>('IMcpToolRouter');

export interface IOpenAiFunctionTool {
	readonly type: 'function';
	readonly function: {
		readonly name: string;
		readonly description?: string;
		readonly parameters?: unknown;
	};
}

export interface IToolExecutionResult {
	readonly isError?: boolean;
	readonly content: unknown;
	readonly mimeType: string;
	readonly bytes: VSBuffer;
}

function toolNameFor(serverId: string, toolName: string): string {
	return `mcp__${serverId}__${toolName}`;
}

function parseToolName(name: string): { serverId: string; toolName: string } | undefined {
	const prefix = 'mcp__';
	if (!name.startsWith(prefix)) {
		return undefined;
	}
	const rest = name.slice(prefix.length);
	const idx = rest.indexOf('__');
	if (idx <= 0) {
		return undefined;
	}
	return { serverId: rest.slice(0, idx), toolName: rest.slice(idx + 2) };
}

export interface IMcpToolRouter {
	readonly _serviceBrand: undefined;

	listOpenAiTools(): Promise<readonly IOpenAiFunctionTool[]>;
	executeTool(name: string, parameters: unknown, token: CancellationToken): Promise<IToolExecutionResult>;
}

export class McpToolRouter implements IMcpToolRouter {
	readonly _serviceBrand: undefined;

	constructor(
		@IMcpService private readonly _mcpService: IMcpService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@IQuickInputService private readonly _quickInputService: IQuickInputService,
		@ILogService private readonly _logService: ILogService,
	) { }

	private _isAllowedServer(serverId: string): boolean {
		const allowed = this._configurationService.getValue<string[] | undefined>(SolideAiSettingId.McpAllowedServers);
		return Array.isArray(allowed) && allowed.includes(serverId);
	}

	private _matchesAnyPattern(value: string, patterns: string[]): boolean {
		for (const pattern of patterns) {
			if (pattern === '*') {
				return true;
			}
			// Simple glob: prefix/suffix '*' only.
			if (pattern.startsWith('*') && pattern.endsWith('*')) {
				const inner = pattern.slice(1, -1);
				if (inner && value.includes(inner)) {
					return true;
				}
				continue;
			}
			if (pattern.startsWith('*')) {
				const suffix = pattern.slice(1);
				if (value.endsWith(suffix)) {
					return true;
				}
				continue;
			}
			if (pattern.endsWith('*')) {
				const prefix = pattern.slice(0, -1);
				if (value.startsWith(prefix)) {
					return true;
				}
				continue;
			}
			if (value === pattern) {
				return true;
			}
		}
		return false;
	}

	private _isAllowedTool(toolName: string): boolean {
		const allowed = this._configurationService.getValue<string[] | undefined>(SolideAiSettingId.McpAllowedTools);
		if (!Array.isArray(allowed) || !allowed.length) {
			return false;
		}
		return this._matchesAnyPattern(toolName, allowed);
	}

	async listOpenAiTools(): Promise<readonly IOpenAiFunctionTool[]> {
		await this._mcpService.activateCollections();

		const result: IOpenAiFunctionTool[] = [];
		for (const server of this._mcpService.servers.get()) {
			if (!this._isAllowedServer(server.definition.id)) {
				continue;
			}
			// Best effort: if tools are not live, user will be prompted when tool is actually called.
			for (const tool of server.tools.get()) {
				const def = tool.definition;
				if (!this._isAllowedTool(def.name)) {
					continue;
				}
				result.push({
					type: 'function',
					function: {
						name: toolNameFor(server.definition.id, def.name),
						description: def.description,
						parameters: def.inputSchema ?? { type: 'object' },
					}
				});
			}
		}
		return result;
	}

	async executeTool(name: string, parameters: unknown, token: CancellationToken): Promise<IToolExecutionResult> {
		const parsed = parseToolName(name);
		if (!parsed) {
			throw new Error(`Unknown tool name: ${name}`);
		}

		if (!this._isAllowedServer(parsed.serverId) || !this._isAllowedTool(parsed.toolName)) {
			throw new Error(`Tool call blocked by policy: ${parsed.serverId}.${parsed.toolName}`);
		}

		const server = this._mcpService.servers.get().find(s => s.definition.id === parsed.serverId);
		if (!server) {
			throw new Error(`Unknown MCP server: ${parsed.serverId}`);
		}

		const approved = await this._quickInputService.pick([
			{ id: 'approve', label: 'Approve' },
			{ id: 'deny', label: 'Deny' },
		], {
			placeHolder: `Allow tool call: ${parsed.serverId}.${parsed.toolName}`,
		});

		if (!approved || approved.id !== 'approve') {
			throw new Error('Tool call denied by user');
		}

		// Ensure server is started if needed. Use default prompts/trust flow.
		try {
			await server.start({ promptType: 'only-new' });
		} catch (error) {
			this._logService.error('[McpToolRouter] Failed to start server', error);
		}

		const tool = server.tools.get().find(t => t.definition.name === parsed.toolName);
		if (!tool) {
			throw new Error(`Unknown tool '${parsed.toolName}' on server '${parsed.serverId}'`);
		}

		const args = (parameters && typeof parameters === 'object') ? (parameters as Record<string, unknown>) : {};
		this._logService.info('[McpToolRouter] Executing tool', { serverId: parsed.serverId, tool: parsed.toolName });

		const result: MCP.CallToolResult = await tool.call(args, undefined, token);
		const json = JSON.stringify(result);
		return {
			isError: result.isError,
			content: result,
			mimeType: 'application/json',
			bytes: VSBuffer.fromString(json),
		};
	}
}

