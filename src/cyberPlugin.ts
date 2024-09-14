import { Plugin } from "obsidian";
import { searchSite } from "./sidebar";

interface CyberPluginSettings {
	validTld: string[];
	searchSites: searchSite[];
}

export class CyberPlugin extends Plugin {
	settings: CyberPluginSettings | undefined;
	validTld: string[] | null | undefined;
}