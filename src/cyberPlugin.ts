import { App, EventRef, Plugin, PluginManifest, TAbstractFile, TFile, WorkspaceLeaf } from "obsidian";
import { EventEmitter } from "events";

import { SearchSite } from "./searchSites";
import { getAttachments } from "./vaultUtils";
import { getMatches } from "./matcher";
import { initializeWorker } from "./ocr";
import { validateDomains } from "./textUtils";
import { filterExclusions, IndicatorExclusion, ParsedIndicators } from "./iocParser";
import { IEventEmitter, IOcrProcessor, IOcrProvider, OcrCompletePayload, OcrErrorPayload, OcrJobData, OcrProgressPayload, OcrProvider, OcrProviderEvent, TesseractOcrProcessor } from "./ocr/ocrProvider";
import { readImageFile } from "./ocr/utils";

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

export type CyberPluginEvent = 'settings-change' | 'file-opened' | 'file-modified' | 'attachments-changed' | 'indicators-changed';

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
    protected ocrCache: Map<string, Map<string, ParsedIndicators[]>> = new Map();
    protected exclusions: IndicatorExclusions;
    private fileOpenRef: EventRef | null = null;
    private fileModifyRef: EventRef | null = null;
    private vaultCacheRef: EventRef | null = null;
    protected activeFile: TFile | null = null;
    protected activeFileContent: string | null = null;
    protected activeFileAttachments: TFile[] | null = null;

    protected ocrProvider: IOcrProvider | null = null;
    private ocrProcessingEmitter: IEventEmitter<OcrProviderEvent>;
    protected uiNotifier: IEventEmitter<{ type: CyberPluginEvent; payload: unknown }>;

    private ocrProgressRef?: (payload: OcrProgressPayload) => void;
    private ocrCompleteRef?: (payload: OcrCompletePayload) => Promise<void>;
    private ocrErrorRef?: (payload: OcrErrorPayload) => void;

    private worker: Tesseract.Worker | null = null;
    // private fileProgressRef: () => void;
    // private fileCompleteRef: () => void;

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

        this.uiNotifier = new EventEmitter() as IEventEmitter<{ type: CyberPluginEvent; payload: unknown }>;
        this.ocrProcessingEmitter = new EventEmitter() as IEventEmitter<OcrProviderEvent>;
        const cacheChecker = this.hasCachedOcrResult.bind(this);
        this.ocrProvider = new OcrProvider([], cacheChecker);

        this.registerObsidianListeners();
    }

    async onload(): Promise<void> {
        if (!this.ocrProvider) {
            await this.initializeOcrSystem();
        }

        this.setupOcrEventListeners();

        this.worker = await initializeWorker();
        this.ocrProvider?.addProcessor(new TesseractOcrProcessor(this.worker));
    }

    async refreshIndicators() {
        // Refresh static indicators from Markdown content
        if (this.activeFile && this.activeFileContent) {
            this.indicators = await getMatches(this.activeFileContent);
        }

        this.emitter.emit('indicators-changed');
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

    registerObsidianListeners(): void {
        this.fileOpenRef = this.app.workspace.on('file-open', this.handleFileOpen.bind(this));
        this.fileModifyRef = this.app.vault.on('modify', this.handleFileModify.bind(this));
        this.vaultCacheRef = this.app.metadataCache.on('resolve', this.handleMetadataResolve.bind(this));
    }

    async handleFileOpen(file: TFile | null): Promise<void> {
        if (file && file instanceof TFile) {
            this.activeFile = file;
            this.activeFileContent = await this.app.vault.cachedRead(file);
            this.compareAttachments(file);
            this.emitter.emit('file-opened');
            this.triggerOcrProcessing();
        } else {
            this.activeFile = null;
            this.activeFileContent = null;
            this.activeFileAttachments = null;
            this.indicators = [];
            this.ocrIndicators = [];
        }
        await this.refreshIndicators();
    }

    async handleFileModify(file: TAbstractFile): Promise<void> {
        if (file === this.activeFile && file instanceof TFile) {
            this.activeFileContent = await this.app.vault.cachedRead(file);
            this.compareAttachments(file);
            this.emitter.emit('file-modified');
            await this.refreshIndicators();
        }
    }

    async handleMetadataResolve(file: TFile): Promise<void> {
        if (file === this.activeFile) {
            this.compareAttachments(file);
            await this.refreshIndicators();
        }
    }

    private async triggerOcrProcessing(): Promise<void> {
        if (!this.ocrProvider || !this.activeFileAttachments || this.activeFileAttachments.length === 0) {
            return;
        }

        console.debug(`Triggering OCR for ${this.activeFileAttachments.length} new attachment(s)...`);

        const ocrJobs: OcrJobData[] = [];
        for (const att of this.activeFileAttachments) {
            try {
                const content = await readImageFile(this.app, att);
                ocrJobs.push({
                    fileId: att.path,
                    imageData: content
                });
                console.log(`Added Job for ${att.path}`);
            } catch (error) {
                console.error(`Failed to read or encode attachment ${att.path}`, error);
                this.handleOcrError({
                    fileId: att.path,
                    processorId: 'plugin',
                    error: `Failed to read file: ${error}`,
                    canRetry: false
                })
            }
        }

        if (ocrJobs.length > 0) {
            this.ocrProvider.processAttachments(this.activeFile?.path ?? 'unknown', ocrJobs)
                .catch((error: any) => {
                    console.error(`Error occurred during OCR Provider processAttachments call:`, error);
                });
        }
    }

    /**
     * Add search sites to a set of ParsedIndicators.
     */
    protected applySearchSites(indicators: ParsedIndicators[]): ParsedIndicators[] {
        if (!this.settings?.searchSites) return indicators;
        return indicators.map(indicator => {
            const indicatorCopy = { ...indicator };

            switch (indicator.title) {
                case "IPs (Public)":
                case "IPs (Private)":
                case "IPv6":
                    indicatorCopy.sites = this.settings?.searchSites.filter(
                        (x: SearchSite) => x.enabled && x.ip
                    );
                    break;
                case "Domains":
                    indicatorCopy.sites = this.settings?.searchSites.filter(
                        (x: SearchSite) => x.enabled && x.domain
                    );
                    break;
                case "Hashes":
                    indicatorCopy.sites = this.settings?.searchSites.filter(
                        (x: SearchSite) => x.enabled && x.hash
                    );
                default:
                    // No sites for unknown indicator types
                    indicatorCopy.sites = [];
            }

            return indicatorCopy;
        });
    }

    /**
     * Validate that domains end with a valid TLD
     */
    protected validateDomains(indicators: ParsedIndicators[]): ParsedIndicators[] {
        if (!this.validTld) return indicators;
        return indicators.map(indicator => {
            const indicatorCopy = { ...indicator };

            // Only validate domains
            if (this.validTld && indicator.title === "Domain" && indicator.items.length > 0) {
                indicatorCopy.items = validateDomains(indicator.items, this.validTld);
            }

            return indicatorCopy;
        });
    }

    protected processExclusions(indicators: ParsedIndicators[]): ParsedIndicators[] {
        return indicators.map(iocs => {
            const processed = { ...iocs };

            switch(processed.title) {
                case "IPs":
                case "IPs (Public)":
                case "IPs (Private)":
                    processed.exclusions = this.exclusions.ipv4Exclusions;
                    break;
                case "IPv6":
                    processed.exclusions = this.exclusions.ipv6Exclusions;
                    break;
                case "Domains":
                    processed.exclusions = this.exclusions.domainExclusions;
                    break;
                case "Hashes":
                    processed.exclusions = this.exclusions.hashExclusions;
                    break;
                default:
                    processed.exclusions = [];
                    break;
            }

            if (processed.exclusions.length > 0) {
                processed.items = filterExclusions(processed.items, processed.exclusions);
            }

            return processed;
        });
    }

    async initializeOcrSystem(): Promise<void> {
        const processors: IOcrProcessor[] = [];

        if (processors.length === 0) {
            console.warn("No OCR processors were successfully initialized.");
            return;
        }
        const cacheChecker = this.hasCachedOcrResult.bind(this);

        this.ocrProvider = new OcrProvider(processors, cacheChecker);
        console.log(`OCR Provider initialized with ${processors.length} processors`);
    }

    public hasCachedOcrResult(fileId: string, processorId: string): boolean {
        const hasResult = this.ocrCache.get(fileId)?.has(processorId) ?? false;
        if (hasResult) {
            console.debug(`[Cache Check] Cache hit for ${fileId} using ${processorId}.`);
        }
        return hasResult;
    }

    setupOcrEventListeners(): void {
        if (!this.ocrProvider) return;

        this.ocrCompleteRef = this.handleOcrComplete.bind(this);
        this.ocrErrorRef = this.handleOcrError.bind(this);
        this.ocrProgressRef = this.handleOcrProgress.bind(this);

        this.ocrProvider.emitter.on('ocr-complete', this.ocrCompleteRef);
        this.ocrProvider.emitter.on('ocr-error', this.ocrErrorRef);
        this.ocrProvider.emitter.on('ocr-progress', this.ocrProgressRef);
    }

    async handleOcrComplete(payload: OcrCompletePayload): Promise<void> {
        console.debug(`OCR Complete: ${payload.fileId} by ${payload.processorId}`);
        if (!this.activeFileAttachments?.some(att => att.path === payload.fileId)) {
            console.warn(`Received OCR result for ${payload.fileId} which is not an attachment of the active file`);
            return;
        }

        const indicators = await getMatches(payload.extractedText);

        if (!this.ocrCache.has(payload.fileId)) {
            this.ocrCache.set(payload.fileId, new Map<string, ParsedIndicators[]>());
        }
        const fileCache = this.ocrCache.get(payload.fileId);
        if (fileCache) {
            fileCache.set(payload.processorId, indicators);
            console.debug(`Cached OCR results from ${payload.processorId} for ${payload.fileId}`);
        }
        console.log(indicators);
    }

    handleOcrError(payload: OcrErrorPayload): void {
        console.error(`OCR error: ${payload.fileId} by ${payload.processorId}:`, payload.error);
    }

    handleOcrProgress(payload: OcrProgressPayload): void {
        console.debug(`OCR Progress: ${payload.fileId} by ${payload.processorId}: ${payload.status} ${payload.progressPercent ?? ''}% ${payload.message ?? ''}`);
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
        if (this.fileOpenRef) this.app.workspace.offref(this.fileOpenRef);
        if (this.fileModifyRef) this.app.vault.offref(this.fileModifyRef);
        if (this.vaultCacheRef) this.app.metadataCache.offref(this.vaultCacheRef);
        
        this.worker?.terminate();
    }
}