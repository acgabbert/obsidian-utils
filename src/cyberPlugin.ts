import { App, EventRef, Plugin, PluginManifest, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
import { EventEmitter } from "events";

import { SearchSite } from "./searchSites";
import { getAttachments } from "./vaultUtils";
import { IndicatorExclusion, NewOCRProvider, ParsedIndicators } from "./iocParser";
import { getMatches } from "./matcher";
import { TesseractOcrProvider, TesseractProcessor } from "./ocr/tesseractProvider";
import { initializeWorker } from "./ocr";

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

export type CyberPluginEvent = 'settings-change' | 'file-opened' | 'file-modified' | 'attachments-changed';

/**
 * An Obsidian plugin class focused on Cybersecurity use cases.
 */
export class CyberPlugin extends Plugin {
    settings: CyberPluginSettings | undefined;
    validTld: string[] | null | undefined;
    sidebarContainers: Map<string, WorkspaceLeaf> | undefined;
    protected emitter: EventEmitter;
    protected indicators: ParsedIndicators[];
    protected ocrIndicators: ParsedIndicators[] | null = null;
    protected exclusions: IndicatorExclusions;
    private fileOpenRef: EventRef;
    private fileModifyRef: EventRef;
    private vaultCacheRef: EventRef;
    protected activeFile: TFile | null = null;
    protected activeFileContent: string | null = null;
    protected activeFileAttachments: TFile[] | null = null;

    protected ocrProvider: NewOCRProvider;
    private worker: Tesseract.Worker | null = null;
    private fileProgressRef: () => void;
    private fileCompleteRef: () => void;
    private ocrProgressRef: () => void;
    private ocrCompleteRef: () => void;

    constructor(app: App, manifest: PluginManifest) {
        super(app, manifest);
        
        // Initialize emitter
        this.emitter = new EventEmitter();

        // Initialize indicators and exclusions
        this.indicators = [];
        this.exclusions = {
            ipv4Exclusions: [],
            ipv6Exclusions: [],
            hashExclusions: [],
            domainExclusions: []
        }

        this.ocrProvider = new NewOCRProvider(this);

        this.fileOpenRef = this.app.workspace.on('file-open', async (file: TFile | null) => {
            if (file) {
                this.activeFile = file;
                this.activeFileContent = await this.app.vault.cachedRead(file);
                this.compareAttachments(file);
                this.emitter.emit('file-opened');
            } else {
                this.activeFileContent = null;
            }
        });

        this.fileModifyRef = this.app.vault.on('modify', async (file: TAbstractFile) => {
            if (file === this.activeFile && file instanceof TFile) {
                this.activeFileContent = await this.app.vault.cachedRead(file);
                this.compareAttachments(file);
                this.emitter.emit('file-modified');
            } else {
                this.activeFileContent = null;
            }
        });

        this.vaultCacheRef = this.app.metadataCache.on('resolve', (file: TFile) => {
            if (file === this.activeFile) {
                this.compareAttachments(file);
            }
        });

        this.fileProgressRef = this.ocrProvider.on('file-progress', (fileProgress) => {
            console.log(`File ${fileProgress.fileName} processed by ${fileProgress.processorName}: ${fileProgress.progress}%`);
        });

        this.fileCompleteRef = this.ocrProvider.on('file-complete', (fileComplete) => {
            // Add the partial OCR results
            if (!this.ocrIndicators) {
                this.ocrIndicators = [];
            }

        })
    }

    async onload(): Promise<void> {
        this.worker = await initializeWorker();
        this.ocrProvider.registerProcessor(new TesseractProcessor(this.worker));
    }

    async refreshIndicators() {
        if (this.activeFile && this.activeFileContent) {
            this.indicators = await getMatches(this.activeFileContent, this);
        }
    }

    getFileContent(): string | null {
        return this.activeFileContent;
    }

    getFileAttachments(): TFile[] {
        return this.activeFileAttachments ?? [];
    }

    getIocExclusions(): IndicatorExclusions {
        return this.exclusions;
    }

    /**
     * Compare attachments for the current file against the plugin's attachment list.
     * @param file the file to evaluate
     * @returns true if attachments are unchanged, false if attachments have changed
     */
    private compareAttachments(file: TFile): boolean {
        const attachments = getAttachments(file.path, this.app);
        const set1 = new Set(attachments);
        const set2 = new Set(this.activeFileAttachments);

        const unchanged = set1.size === set2.size && [...set1].every(item => set2.has(item));

        if (!unchanged) {
            this.activeFileAttachments = attachments;
            this.emitter.emit('attachments-changed');
        }
        return unchanged;
    }

    /**
     * Activate a view of the given type in the right sidebar.
     * @param type a view type
     */
    async activateView(type: string): Promise<void> {
        const { workspace } = this.app;
        let leaf = await workspace.ensureSideLeaf(type, 'right', { active: true });
        this.sidebarContainers?.set(type, leaf);
    }

    on(event: CyberPluginEvent, callback: (...args: any[]) => void) {
        this.emitter.on(event, callback);
        return () => this.emitter.off(event, callback);
    }

    async saveSettings() {
        await this.saveData(this.settings);
        this.emitter.emit('settings-change');
    }

    async onunload(): Promise<void> {
        this.app.workspace.offref(this.fileOpenRef);
        this.app.vault.offref(this.fileModifyRef);
        this.app.metadataCache.offref(this.vaultCacheRef);
        
        this.worker?.terminate();
    }
}