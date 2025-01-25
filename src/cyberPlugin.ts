import { App, Plugin, PluginManifest, WorkspaceLeaf } from "obsidian";
import { EventEmitter } from "events";

import { SearchSite } from "./searchSites";
import { Matcher } from "./matcher";

export interface CyberPluginSettings {
	validTld: string[];
	searchSites: SearchSite[];
}

export class CyberPlugin extends Plugin {
	settings: CyberPluginSettings | undefined;
	validTld: string[] | null | undefined;
	sidebarContainers: Map<string, WorkspaceLeaf> | undefined;
	protected emitter: EventEmitter;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
		this.emitter = new EventEmitter();
	}

	async activateView(type: string): Promise<void> {
		/**
		 * Activate a view of the given type in the right sidebar.
		 * @param type a view type
		 */
		const {workspace} = this.app;
		let leaf = await workspace.ensureSideLeaf(type, 'right', {active: true});
		this.sidebarContainers?.set(type, leaf);
	}
	
	on(event: string, callback: (...args: any[]) => void) {
		this.emitter.on(event, callback);
		return () => this.emitter.off(event, callback);
	}
	
	async saveSettings() {
		await this.saveData(this.settings);
		this.emitter.emit('settings-change');
	}
}