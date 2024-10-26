import { App, Plugin, PluginManifest, WorkspaceLeaf } from "obsidian";
import { searchSite } from "./sidebar";

interface CyberPluginSettings {
	validTld: string[];
	searchSites: searchSite[];
}

export class CyberPlugin extends Plugin {
	settings: CyberPluginSettings | undefined;
	validTld: string[] | null | undefined;
	sidebarContainers: Map<string, WorkspaceLeaf> | undefined;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest);
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
}