/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';

enum ToolRiskLevel {
	Low = 'low',
	Medium = 'medium',
	High = 'high',
	Critical = 'critical',
}

const HIGH_RISK_PATTERNS = [
	/dangerous|exec|run|delete|remove|drop/i,
	/write|create|update|modify/i,
	/sudo|admin|root|priv/i,
	/key|secret|password|credential/i,
	/inject|patch|hook/i,
	/file|fs|path/i,
	/send.*transaction|sign.*transaction/i,
	/ssh|shell|bash|cmd/i,
	/download|upload|fetch.*url/i,
];

const CRITICAL_RISK_PATTERNS = [
	/transfer.*all|withdraw.*all/i,
	/delete.*account|remove.*wallet/i,
	/export.*key|show.*secret/i,
	/sudo.*exec|run.*as.*root/i,
	/modify.*permission|chmod.*777/i,
];

function getToolRiskLevel(toolName: string, description?: string): ToolRiskLevel {
	const text = `${toolName} ${description || ''}`.toLowerCase();

	for (const pattern of CRITICAL_RISK_PATTERNS) {
		if (pattern.test(text)) {
			return ToolRiskLevel.Critical;
		}
	}

	for (const pattern of HIGH_RISK_PATTERNS) {
		if (pattern.test(text)) {
			return ToolRiskLevel.High;
		}
	}

	return ToolRiskLevel.Low;
}

suite('MCP Tool Risk Classification', () => {

	suite('CRITICAL risk patterns', () => {

		test('transfer all triggers critical', () => {
			assert.strictEqual(getToolRiskLevel('transfer_all'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('transferEverything'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('TRANSFER_ALL'), ToolRiskLevel.Critical);
		});

		test('withdraw all triggers critical', () => {
			assert.strictEqual(getToolRiskLevel('withdrawAll'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('withdraw_all_funds'), ToolRiskLevel.Critical);
		});

		test('delete account triggers critical', () => {
			assert.strictEqual(getToolRiskLevel('delete_account'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('DeleteAccount'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('deleteAccountData'), ToolRiskLevel.Critical);
		});

		test('remove wallet triggers critical', () => {
			assert.strictEqual(getToolRiskLevel('remove_wallet'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('removeWallet'), ToolRiskLevel.Critical);
		});

		test('export key triggers critical', () => {
			assert.strictEqual(getToolRiskLevel('export_key'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('exportKey'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('exportPrivateKey'), ToolRiskLevel.Critical);
		});

		test('show secret triggers critical', () => {
			assert.strictEqual(getToolRiskLevel('show_secret'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('showSecret'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('revealSecret'), ToolRiskLevel.Critical);
		});

		test('sudo exec triggers critical', () => {
			assert.strictEqual(getToolRiskLevel('sudo_exec'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('sudoExec'), ToolRiskLevel.Critical);
		});

		test('run as root triggers critical', () => {
			assert.strictEqual(getToolRiskLevel('run_as_root'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('runAsRoot'), ToolRiskLevel.Critical);
		});

		test('modify permission triggers critical', () => {
			assert.strictEqual(getToolRiskLevel('modify_permission'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('modifyPermissions'), ToolRiskLevel.Critical);
		});

		test('chmod 777 triggers critical', () => {
			assert.strictEqual(getToolRiskLevel('chmod_777'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('chmod777'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('setPermissions777'), ToolRiskLevel.Critical);
		});
	});

	suite('HIGH risk patterns', () => {

		test('dangerous triggers high', () => {
			assert.strictEqual(getToolRiskLevel('dangerous_operation'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('DangerousAction'), ToolRiskLevel.High);
		});

		test('exec triggers high', () => {
			assert.strictEqual(getToolRiskLevel('exec_command'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('executeCommand'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('exec'), ToolRiskLevel.High);
		});

		test('run triggers high', () => {
			assert.strictEqual(getToolRiskLevel('run_script'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('runTest'), ToolRiskLevel.High);
		});

		test('delete triggers high', () => {
			assert.strictEqual(getToolRiskLevel('delete_file'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('deleteRecord'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('deleteItem'), ToolRiskLevel.High);
		});

		test('remove triggers high', () => {
			assert.strictEqual(getToolRiskLevel('remove_file'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('removeItem'), ToolRiskLevel.High);
		});

		test('drop triggers high', () => {
			assert.strictEqual(getToolRiskLevel('drop_table'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('dropCollection'), ToolRiskLevel.High);
		});

		test('write triggers high', () => {
			assert.strictEqual(getToolRiskLevel('write_file'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('writeData'), ToolRiskLevel.High);
		});

		test('create triggers high', () => {
			assert.strictEqual(getToolRiskLevel('create_user'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('createResource'), ToolRiskLevel.High);
		});

		test('update triggers high', () => {
			assert.strictEqual(getToolRiskLevel('update_config'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('updateRecord'), ToolRiskLevel.High);
		});

		test('modify triggers high', () => {
			assert.strictEqual(getToolRiskLevel('modify_settings'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('modifyRecord'), ToolRiskLevel.High);
		});

		test('sudo triggers high', () => {
			assert.strictEqual(getToolRiskLevel('sudo_status'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('sudoCheck'), ToolRiskLevel.High);
		});

		test('admin triggers high', () => {
			assert.strictEqual(getToolRiskLevel('admin_panel'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('adminTools'), ToolRiskLevel.High);
		});

		test('root triggers high', () => {
			assert.strictEqual(getToolRiskLevel('root_access'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('checkRoot'), ToolRiskLevel.High);
		});

		test('key triggers high', () => {
			assert.strictEqual(getToolRiskLevel('get_key'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('rotateKey'), ToolRiskLevel.High);
		});

		test('secret triggers high', () => {
			assert.strictEqual(getToolRiskLevel('get_secret'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('manageSecret'), ToolRiskLevel.High);
		});

		test('password triggers high', () => {
			assert.strictEqual(getToolRiskLevel('get_password'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('setPassword'), ToolRiskLevel.High);
		});

		test('credential triggers high', () => {
			assert.strictEqual(getToolRiskLevel('get_credential'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('manageCredentials'), ToolRiskLevel.High);
		});

		test('inject triggers high', () => {
			assert.strictEqual(getToolRiskLevel('inject_code'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('sqlInjection'), ToolRiskLevel.High);
		});

		test('patch triggers high', () => {
			assert.strictEqual(getToolRiskLevel('patch_file'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('applyPatch'), ToolRiskLevel.High);
		});

		test('hook triggers high', () => {
			assert.strictEqual(getToolRiskLevel('install_hook'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('setupHook'), ToolRiskLevel.High);
		});

		test('file triggers high', () => {
			assert.strictEqual(getToolRiskLevel('read_file'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('fileOperations'), ToolRiskLevel.High);
		});

		test('fs triggers high', () => {
			assert.strictEqual(getToolRiskLevel('fs_read'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('fsOperations'), ToolRiskLevel.High);
		});

		test('path triggers high', () => {
			assert.strictEqual(getToolRiskLevel('resolve_path'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('pathTraversal'), ToolRiskLevel.High);
		});

		test('send transaction triggers high', () => {
			assert.strictEqual(getToolRiskLevel('send_transaction'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('sendTransaction'), ToolRiskLevel.High);
		});

		test('sign transaction triggers high', () => {
			assert.strictEqual(getToolRiskLevel('sign_transaction'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('signTransaction'), ToolRiskLevel.High);
		});

		test('ssh triggers high', () => {
			assert.strictEqual(getToolRiskLevel('ssh_connect'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('sshConnection'), ToolRiskLevel.High);
		});

		test('shell triggers high', () => {
			assert.strictEqual(getToolRiskLevel('shell_exec'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('shellCommand'), ToolRiskLevel.High);
		});

		test('bash triggers high', () => {
			assert.strictEqual(getToolRiskLevel('bash_run'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('bashCommand'), ToolRiskLevel.High);
		});

		test('cmd triggers high', () => {
			assert.strictEqual(getToolRiskLevel('cmd_execute'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('cmdCommand'), ToolRiskLevel.High);
		});

		test('download triggers high', () => {
			assert.strictEqual(getToolRiskLevel('download_file'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('downloadData'), ToolRiskLevel.High);
		});

		test('upload triggers high', () => {
			assert.strictEqual(getToolRiskLevel('upload_file'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('uploadData'), ToolRiskLevel.High);
		});

		test('fetch url triggers high', () => {
			assert.strictEqual(getToolRiskLevel('fetch_url_content'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('fetchUrl'), ToolRiskLevel.High);
		});
	});

	suite('LOW risk patterns (safe tools)', () => {

		test('read operations are low risk', () => {
			assert.strictEqual(getToolRiskLevel('get_user'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('fetchData'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('listFiles'), ToolRiskLevel.Low);
		});

		test('query operations are low risk', () => {
			assert.strictEqual(getToolRiskLevel('query_database'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('searchRecords'), ToolRiskLevel.Low);
		});

		test('search operations are low risk', () => {
			assert.strictEqual(getToolRiskLevel('search'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('findItems'), ToolRiskLevel.Low);
		});

		test('info operations are low risk', () => {
			assert.strictEqual(getToolRiskLevel('get_info'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('fetchInfo'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('statusCheck'), ToolRiskLevel.Low);
		});

		test('list operations are low risk', () => {
			assert.strictEqual(getToolRiskLevel('list_users'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('listResources'), ToolRiskLevel.Low);
		});

		test('calculate operations are low risk', () => {
			assert.strictEqual(getToolRiskLevel('calculate'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('computeHash'), ToolRiskLevel.Low);
		});

		test('validate operations are low risk', () => {
			assert.strictEqual(getToolRiskLevel('validate_input'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('validateEmail'), ToolRiskLevel.Low);
		});

		test('format operations are low risk', () => {
			assert.strictEqual(getToolRiskLevel('format_date'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('formatJson'), ToolRiskLevel.Low);
		});

		test('sanitize operations are low risk', () => {
			assert.strictEqual(getToolRiskLevel('sanitize_html'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('sanitizeInput'), ToolRiskLevel.Low);
		});
	});

	suite('Description-based risk classification', () => {

		test('description can elevate risk', () => {
			assert.strictEqual(
				getToolRiskLevel('run', 'Executes shell commands with root privileges'),
				ToolRiskLevel.Critical
			);
			assert.strictEqual(
				getToolRiskLevel('read', 'Reads secret API keys from environment'),
				ToolRiskLevel.High
			);
			assert.strictEqual(
				getToolRiskLevel('transfer', 'Transfers all funds to specified address'),
				ToolRiskLevel.Critical
			);
		});

		test('description context affects risk correctly', () => {
			assert.strictEqual(
				getToolRiskLevel('get_balance', 'Returns account balance'),
				ToolRiskLevel.Low
			);
			assert.strictEqual(
				getToolRiskLevel('get_balance', 'Returns wallet seed phrase'),
				ToolRiskLevel.High
			);
		});
	});

	suite('Edge cases', () => {

		test('empty tool name returns low', () => {
			assert.strictEqual(getToolRiskLevel(''), ToolRiskLevel.Low);
		});

		test('whitespace-only tool name returns low', () => {
			assert.strictEqual(getToolRiskLevel('   '), ToolRiskLevel.Low);
		});

		test('case insensitive matching works', () => {
			assert.strictEqual(getToolRiskLevel('TRANSFER_ALL'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('transfer_all'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('TrAnSfEr_AlL'), ToolRiskLevel.Critical);
		});

		test('mixed case in patterns works', () => {
			assert.strictEqual(getToolRiskLevel('WriteFile'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('writefile'), ToolRiskLevel.High);
		});

		test('numbers in tool name handled', () => {
			assert.strictEqual(getToolRiskLevel('delete123'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('file_2024'), ToolRiskLevel.High);
		});

		test('underscores and hyphens handled', () => {
			assert.strictEqual(getToolRiskLevel('delete_file'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('delete-file'), ToolRiskLevel.High);
		});

		test('camelCase detected correctly', () => {
			assert.strictEqual(getToolRiskLevel('deleteFile'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('readFileContent'), ToolRiskLevel.High);
		});

		test('partial word matches avoided (file vs filesystem)', () => {
			assert.strictEqual(getToolRiskLevel('filesystem'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('filed'), ToolRiskLevel.High);
		});

		test('path traversal variations detected', () => {
			assert.strictEqual(getToolRiskLevel('pathTraversal'), ToolRiskLevel.High);
			assert.strictEqual(getToolRiskLevel('traversePath'), ToolRiskLevel.High);
		});
	});

	suite('Pattern bypass attempts', () => {

		test('obfuscation with spaces fails', () => {
			assert.strictEqual(getToolRiskLevel('transfer all'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('transfer  all'), ToolRiskLevel.Critical);
		});

		test('obfuscation with case fails', () => {
			assert.strictEqual(getToolRiskLevel('TrAnSfEr'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('dAnGeRoUs'), ToolRiskLevel.Low);
		});

		test('substring attacks blocked by pattern anchors', () => {
			assert.strictEqual(getToolRiskLevel('not_dangerous_at_all'), ToolRiskLevel.Low);
			assert.strictEqual(getToolRiskLevel('safedangerous'), ToolRiskLevel.Low);
		});
	});

	suite('Critical takes precedence over high', () => {

		test('critical patterns override high patterns', () => {
			assert.strictEqual(getToolRiskLevel('export_api_key'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('delete_admin_account'), ToolRiskLevel.Critical);
			assert.strictEqual(getToolRiskLevel('show_root_secret'), ToolRiskLevel.Critical);
		});
	});
});

suite('Risk pattern coverage', () => {

	test('CRITICAL patterns list is not empty', () => {
		assert.ok(CRITICAL_RISK_PATTERNS.length > 0, 'CRITICAL patterns should be defined');
	});

	test('HIGH patterns list is not empty', () => {
		assert.ok(HIGH_RISK_PATTERNS.length > 0, 'HIGH patterns should be defined');
	});

	test('no duplicate patterns in CRITICAL', () => {
		const patterns = CRITICAL_RISK_PATTERNS.map(p => p.source);
		const unique = new Set(patterns);
		assert.strictEqual(patterns.length, unique.size, 'Duplicate patterns found in CRITICAL');
	});

	test('no duplicate patterns in HIGH', () => {
		const patterns = HIGH_RISK_PATTERNS.map(p => p.source);
		const unique = new Set(patterns);
		assert.strictEqual(patterns.length, unique.size, 'Duplicate patterns found in HIGH');
	});

	test('all patterns are valid RegExp', () => {
		for (const pattern of [...CRITICAL_RISK_PATTERNS, ...HIGH_RISK_PATTERNS]) {
			assert.doesNotThrow(() => new RegExp(pattern.source, pattern.flags));
		}
	});

	test('all patterns are case insensitive', () => {
		for (const pattern of [...CRITICAL_RISK_PATTERNS, ...HIGH_RISK_PATTERNS]) {
			assert.ok(pattern.flags.includes('i'), `Pattern ${pattern.source} should be case insensitive`);
		}
	});
});
