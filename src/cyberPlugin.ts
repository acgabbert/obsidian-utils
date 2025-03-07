import { App, Plugin, PluginManifest, WorkspaceLeaf } from "obsidian";
import { EventEmitter } from "events";

import { IndicatorExclusion, SearchSite } from "./searchSites";
import { Matcher } from "./matcher";

export interface CyberPluginSettings {
	validTld: string[];
	searchSites: SearchSite[];
}

export interface IndicatorExclusions {
	ipv4Exclusions: IndicatorExclusion[];
	ipv6Exclusions: IndicatorExclusion[];
	hashExclusions: IndicatorExclusion[];
	domainExclusions: IndicatorExclusion[];
}

export class CyberPlugin extends Plugin {
	settings: CyberPluginSettings | undefined;
	validTld: string[] | null | undefined;
	sidebarContainers: Map<string, WorkspaceLeaf> | undefined;
	protected emitter: EventEmitter;
	exclusions: IndicatorExclusions | undefined;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
		this.emitter = new EventEmitter();
		this.exclusions = {
			ipv4Exclusions: [],
			ipv6Exclusions: [],
			hashExclusions: [],
			domainExclusions: []
		}
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