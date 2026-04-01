const vscode = require('vscode');

const HOVERS = {
	AccountInfo: 'Solana account metadata. Includes lamports, owner, executable, and data.',
	Pubkey: 'A 32-byte Solana public key used for accounts, programs, and identities.',
	Context: 'Anchor account validation context passed into program instructions.',
	Program: 'Anchor wrapper around a Solana program account (for CPI targets like System or Token).',
	Signer: 'Anchor account type requiring transaction signature authorization.',
};

const COMMON_ERRORS = {
	'0x1': 'A generic custom program error. Check your program logs for the mapped Anchor/Solana error.',
	InstructionError: 'A top-level transaction instruction failed. Inspect inner logs and the failing instruction index.',
	AccountNotRentExempt: 'The target account balance is below rent exemption. Fund or reallocate as needed.',
	InvalidAccountData: 'The account data layout does not match the program expectations (owner/size/discriminator).',
};

function activate(context) {
	const hoverProvider = vscode.languages.registerHoverProvider(
		[{ language: 'rust' }, { language: 'typescript' }],
		{
			provideHover(document, position) {
				const range = document.getWordRangeAtPosition(position);
				if (!range) {
					return;
				}
				const word = document.getText(range);
				const value = HOVERS[word];
				if (!value) {
					return;
				}
				return new vscode.Hover(new vscode.MarkdownString(`**${word}**\n\n${value}`));
			}
		}
	);

	const explainErrorCommand = vscode.commands.registerCommand('solana.explainError', async () => {
		const value = await vscode.window.showInputBox({
			prompt: 'Enter Solana/Anchor error code or name'
		});
		if (!value) {
			return;
		}
		const explanation = COMMON_ERRORS[value] || 'No built-in explanation found. Use the Solana AI chat panel for deeper analysis.';
		vscode.window.showInformationMessage(`${value}: ${explanation}`);
	});

	context.subscriptions.push(hoverProvider, explainErrorCommand);
}

function deactivate() {}

module.exports = { activate, deactivate };

