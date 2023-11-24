import { App, Editor, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface AIWriterSettings {
	apiKey: string;
	endPoint: string;
	lang: string;
}

const DEFAULT_SETTINGS: AIWriterSettings = {
	apiKey: '1234567890',
	endPoint: 'https://YOURNAME.openai.azure.com',
	lang: 'English'
}

var myHeaders = new Headers();
myHeaders.append("Content-Type", "application/json");



export default class AIWriter extends Plugin {
	settings: AIWriterSettings;

	async onload() {
		await this.loadSettings();

		myHeaders.append("api-key", this.settings.apiKey);

		//console.log(editor.getSelection());

		this.addCommand({
			id: 'aiwriter-command-continue',
			name: 'Continue text',
			editorCallback: (editor: Editor) => {
				const prompt = "You are an AI writing assistant that continues existing text based on context from prior text. Give more weight/priority to the later characters than the beginning ones. Limit your response to no more than 200 characters, but make sure to construct complete sentences."
				this.writeText(editor, prompt);
			}
		});

		this.addCommand({
			id: 'aiwriter-command-rewrite',
			name: 'Rewrite text',
			editorCallback: (editor: Editor) => {
				const prompt = "You are an AI writing assistant that rewrites the given text to be like an article from a news magazine. Include a Strong Headline, create a Engaging Lead make sure that the text has a clear structure is shows a Balanced Perspective and has Quotes where and when necessary."
				this.writeText(editor, prompt);
			}
		});

		this.addCommand({
			id: 'aiwriter-command-summary',
			name: 'Summarize text',
			editorCallback: (editor: Editor) => {
				const prompt = "You are an AI writing assistant that summarizes the given text. Limit your response to no more than 1500 characters, but make sure to construct complete sentences."
				this.writeText(editor, prompt);
			}
		});

		this.addCommand({
			id: 'aiwriter-command-prompt',
			name: 'Create custom prompt',
			editorCallback: async (editor: Editor) => {
				const prompt = await this.openPromptModal();
				if (prompt) {
					this.writeText(editor, prompt);
				}
			},
		});

		this.addSettingTab(new AIWirterSettingTab(this.app, this));
	}



	async writeText(editor: Editor, prompt: string) {

		const noteFile = this.app.workspace.getActiveFile();
		if (noteFile?.name) {
			let text = await this.app.vault.read(noteFile);
			const statusBarItemEl = this.addStatusBarItem();
			statusBarItemEl.setText('Connecting to Azure OpenAI...');

			let langprefix = "You speak and answer in " + this.settings.lang;
			if (this.settings.lang == "auto") {
				langprefix = "Answer in the same language as the inserted input text";
			}

			var raw = JSON.stringify({
				"temperature": 0.7,
				"messages": [
					{
						"role": "system",
						"content": langprefix + ". " + prompt
					},
					{
						"role": "user",
						"content": text
					}
				]
			});

			var requestOptions = {
				method: 'POST',
				headers: myHeaders,
				body: raw
			};

			fetch(this.settings.endPoint + "/openai/deployments/gpt-35-turbo/chat/completions?api-version=2023-05-15", requestOptions)
				.then(response => response.json())
				.then(result => {
					const answer = result.choices[0].message.content;
					editor.replaceSelection(answer);
					statusBarItemEl.setText('');
				})
				.catch(error => {
					new Notice('Error: ' + error);
				})
		} else {
			new Notice('No active note');
		}
	}

	onunload() {

	}



	async openPromptModal(): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = new PropmtModal(this.app, (inputValue) => {
				resolve(inputValue);
			});
			modal.open();
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class PropmtModal extends Modal {
	private callback: (inputValue: string) => void;

	constructor(app: App, callback: (inputValue: string) => void) {
		super(app);
		this.callback = callback;
	}

	onOpen() {
		let { contentEl } = this;

		contentEl.createEl('h6', { text: 'Custom AI Writer prompt:' });

		const input = contentEl.createEl('textarea', { attr: { id: 'aiprompt', rows: '6', cols: '70' } });
		let t = contentEl.querySelector('#aiprompt');
		t?.setText("You are an AI writing assistant that continues existing text based on context from prior text.");

		contentEl.createEl('br');
		contentEl.createEl('br');

		const clearButton = contentEl.createEl('button', { text: 'Clear', attr: { style: 'margin:10px;' } });
		clearButton.addEventListener('click', () => {
			t?.setText('');
		});

		const closeButton = contentEl.createEl('button', { text: 'Run prompt' });
		closeButton.addEventListener('click', () => {
			this.close();
			this.callback(input.value);
		});
	}

	onClose() {
		let { contentEl } = this;
		contentEl.empty();
	}
}


class AIWirterSettingTab extends PluginSettingTab {
	plugin: AIWriter;

	constructor(app: App, plugin: AIWriter) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Azure OpenAI key')
			.setDesc('Authentication key')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));


		new Setting(containerEl)
			.setName('Azure OpenAI Endpoint')
			.setDesc('Endpoint')
			.addText(text => text
				.setPlaceholder('Enter your endpoint')
				.setValue(this.plugin.settings.endPoint)
				.onChange(async (value) => {
					this.plugin.settings.endPoint = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Langauge')
			.setDesc('Choose your language')
			.addDropdown((dropdown) =>
				dropdown
					.addOption('auto', 'Auto detect')
					.addOption('English', 'English')
					.addOption('German', 'German')
					.setValue(this.plugin.settings.lang)
					.onChange((value) => {
						this.plugin.settings.lang = value as 'auto' | 'English' | 'German';
						this.plugin.saveData(this.plugin.settings);
					}),
			);

	}
}
