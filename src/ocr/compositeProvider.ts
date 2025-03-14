import { App } from "obsidian";
import { EventEmitter } from "events";
import { OcrProvider, OcrProviderEvent, ParallelOcrProvider } from "./provider";
import { OcrTask, ProgressCallback } from "./tasks";
import { ParsedIndicators } from "../searchSites";

/**
 * A composite OCR provider that delegates OCR processing to multiple providers.
 * Results from all providers are combined transparently.
 */
/**
 * Callback type for incremental results updates
 */
export type ResultsCallback = (filePath: string, indicators: ParsedIndicators[], providerId: string) => void;

export class CompositeOcrProvider extends ParallelOcrProvider {
    private providers: Map<string, OcrProvider> = new Map();
    protected emitter: EventEmitter = new EventEmitter();
    private combinedResults: Map<string, ParsedIndicators[]> = new Map();
    private providerProgress: Map<string, { progress: number, completed: number, total: number }> = new Map();
    private providerProcessedFiles = new Map<string, Set<string>>();
    private processing: boolean = false;
    private fileProgress: Map<string, number> = new Map();
    private fileProviderStatus: Map<string, Map<string, boolean>> = new Map();
    
    /**
     * Add an OCR provider to the composite
     * @param id A unique identifier for the provider
     * @param provider The provider to add
     */
    addProvider(id: string, provider: OcrProvider): void {
        if (this.providers.has(id)) {
            throw new Error(`Provider with ID "${id}" already exists`);
        }
        
        // Establish event forwarding from this provider

        // Result: forward with provider ID and add to combined results
        provider.on('result', (filePath: string, indicators: ParsedIndicators[]) => {
            if (!this.combinedResults.has(filePath)) {
                this.combinedResults.set(filePath, []);
            }
            this.combinedResults.get(filePath)!.push(...indicators);
            this.emitter.emit('result', filePath, indicators, id);

            if (!this.fileProviderStatus.has(filePath)) {
                this.fileProviderStatus.set(filePath, new Map());
            }
            this.fileProviderStatus.get(filePath)!.set(id, true);

            // Update file progress to 100% for this provider
            this.updateFileProgress(filePath, id, 1.0);
            this.updateOverallProgress();
        });

        // Progress: track progress and emit aggregate progress
        provider.on('progress', (progress: number, completed: number, total: number, task?: OcrTask) => {
            this.providerProgress.set(id, { progress, completed, total });
            this.emitter.emit('providerProgress', id, progress, completed, total, task);

            // Update file-specific progress if task is available
            if (task) {
                this.updateFileProgress(task.filePath, id, task.progress / 100);
            }

            this.updateOverallProgress();
        });

        // Task update: forward with provider ID
        provider.on('taskUpdate', (task: OcrTask) => {
            this.emitter.emit('taskUpdate', task, id);
        });

        // Error: forward with provider ID
        provider.on('error', (error: Error, task?: OcrTask) => {
            this.emitter.emit('error', error, task, id);
        });

        // Complete: check if all providers are complete
        provider.on('complete', () => {
            this.checkAllComplete();
        });

        this.providers.set(id, provider);
    }
    
    /**
     * Remove a provider from the composite
     * @param id The ID of the provider to remove
     * @returns true if the provider was found and removed, false otherwise
     */
    removeProvider(id: string): boolean {
        if (!this.providers.has(id)) {
            return false;
        }
        
        this.providers.delete(id);
        this.providerProgress.delete(id);
        this.updateOverallProgress();
        return true;
    }
    
    /**
     * Get a provider by ID
     * @param id The ID of the provider to get
     * @returns The provider, or undefined if not found
     */
    getProvider(id: string): OcrProvider | undefined {
        return this.providers.get(id);
    }
    
    /**
     * Get all provider IDs
     * @returns Array of provider IDs
     */
    getProviderIds(): string[] {
        return Array.from(this.providers.keys());
    }
    
    /**
     * Process files with all active providers and combine results.
     * Results are reported incrementally through the resultsCallback and 'result' event.
     * @param app the Obsidian app instance
     * @param filePaths Array of file paths to process
     * @returns Promise that resolves to a map of filePath to extracted indicators from all providers
     */
    async processFiles(app: App, filePaths: string[]): Promise<Map<string, ParsedIndicators[]>> {
        // Reset progress tracking
        // this.providerProgress.clear();
        
        if (this.providers.size === 0) {
            return new Map();
        }
        
        this.processing = true;
        this.combinedResults.clear();
        
        // Initialize combined results map
        for (const filePath of filePaths) {
            this.combinedResults.set(filePath, []);
        }

        const processPromises: Promise<Map<string, ParsedIndicators[]>>[] = [];

        for (const [id, provider] of this.providers.entries()) {
            if (provider.isReady()) {
                processPromises.push(provider.processFiles(app, filePaths));
                // Initialize progress tracking
                this.providerProgress.set(id, { progress: 0, completed: 0, total: 0 });
            }
        }

        await Promise.all(processPromises);

        this.processing = false;
        this.emitter.emit('complete');

        return new Map(this.combinedResults);
    }
    
    /**
     * Add files to the processing queue of all providers
     * @param app the Obsidian app instance
     * @param filePaths Array of file paths to add
     */
    addFiles(app: App, filePaths: string[]): void {
        this.processing = true;
        
        // Initialize results map for these files
        for (const filePath of filePaths) {
            if (!this.combinedResults.has(filePath)) {
                this.combinedResults.set(filePath, []);
            }
        }
        
        // Add files to all providers
        for (const [id, provider] of this.providers.entries()) {
            if (provider.isReady()) {
                // Get or create the set of files this provider has processed
                if (!this.providerProcessedFiles.has(id)) {
                    this.providerProcessedFiles.set(id, new Set<string>());
                }
                const processedFiles = this.providerProcessedFiles.get(id)!;
                
                // Filter out files that this provider has already processed
                const newFilePaths = filePaths.filter(filePath => !processedFiles.has(filePath));
                
                // If no new files for this provider, skip
                if (newFilePaths.length === 0) {
                    continue;
                }
                
                // Add new files to this provider
                provider.addFiles(app, newFilePaths);
                
                // Mark these files as being processed by this provider
                newFilePaths.forEach(filePath => processedFiles.add(filePath));
                
                // Initialize or update progress tracking
                const currentProgress = this.providerProgress.get(id);
                if (currentProgress) {
                    this.providerProgress.set(id, {
                        progress: currentProgress.progress,
                        completed: currentProgress.completed,
                        total: currentProgress.total + newFilePaths.length
                    });
                } else {
                    this.providerProgress.set(id, {
                        progress: 0,
                        completed: 0,
                        total: newFilePaths.length
                    });
                }
            }
        }
        
        this.updateOverallProgress();
    }    
    
    /**
     * Cancel all ongoing OCR operations across all providers
     */
    cancel(): void {
        for (const provider of this.providers.values()) {
            provider.cancel();
        }
        
        this.processing = false;
        this.providerProgress.clear();
        this.fileProgress.clear();
        this.fileProviderStatus.clear();
        this.emitter.emit('progress', 0, 0, 0);
    }
    
    /**
     * Check if processing is currently in progress
     * @returns boolean indicating if processing is active
     */
    isProcessing(): boolean {
        return this.processing;
    }
    
    /**
     * Subscribe to result events
     * @param event Event name ('result' for new results)
     * @param listener Callback function
     */
    on(event: OcrProviderEvent | 'providerProgress', listener: (...args: any[]) => void): void {
        this.emitter.on(event, listener);
    }
    
    /**
     * Unsubscribe from result events
     * @param event Event name
     * @param listener Callback function
     */
    off(event: OcrProviderEvent | 'providerProgress', listener: (...args: any[]) => void): void {
        this.emitter.off(event, listener);
    }
    
    /**
     * Check if at least one provider is ready to process files
     * @returns boolean indicating if at least one provider is ready
     */
    isReady(): boolean {
        for (const provider of this.providers.values()) {
            if (provider.isReady()) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Get the tasks status from all providers
     * @returns Combined map of task IDs to task objects from all providers
     */
    getTasksStatus(): Map<string, OcrTask> {
        const combinedTasks = new Map<string, OcrTask>();
        
        for (const [providerId, provider] of this.providers.entries()) {
            const providerTasks = provider.getTasksStatus();
            
            // Add provider ID prefix to task IDs to avoid collisions
            for (const [taskId, task] of providerTasks.entries()) {
                // Create a copy of the task with a prefixed ID
                const prefixedTask: OcrTask = {
                    ...task,
                    id: `${providerId}:${taskId}`
                };
                
                combinedTasks.set(prefixedTask.id, prefixedTask);
            }
        }
        
        return combinedTasks;
    }
    
    /**
     * Update the overall progress based on the progress of all providers
     */
    private updateOverallProgress(currentTask?: OcrTask): void {
        if (this.providerProgress.size === 0) {
            this.emitter.emit('progress', 0, 0, 0);
            return;
        }

        const allFiles = new Set<string>();
        for (const task of Array.from(this.tasks.values())) {
            allFiles.add(task.filePath);
        }

        let completedFiles = 0;
        let totalProgress = 0;

        for (const filePath of allFiles) {
            if (!this.fileProviderStatus.has(filePath)) {
                this.fileProviderStatus.set(filePath, new Map());
            }

            const providerStatus = this.fileProviderStatus.get(filePath)!;
            const activeProviders = Array.from(this.providers.entries())
                .filter(([_, provider]) => provider.isReady())
                .map(([id, _]) => id);
            
            const allProvidersComplete = activeProviders.every(providerId => 
                providerStatus.get(providerId) === true
            );

            if (allProvidersComplete && providerStatus.size > 0) {
                completedFiles++;
            }

            if (!this.fileProgress.has(filePath)) {
                this.fileProgress.set(filePath, 0);
            }
            totalProgress == this.fileProgress.get(filePath)!;
        }

        const fileCount = allFiles.size;
        const overallProgress = fileCount > 0 ? totalProgress / fileCount : 0;

        this.emitter.emit('progress', overallProgress, completedFiles, fileCount);
    }

    /**
     * Update progress for a specific file/provider combination
     */
    private updateFileProgress(filePath: string, providerId: string, progress: number): void {
        // Initialize file progress map if needed
        if (!this.fileProgress.has(filePath)) {
            this.fileProgress.set(filePath, 0);
        }

        // Get all provider progress for this file
        if (!this.fileProviderStatus.has(filePath)) {
            this.fileProviderStatus.set(filePath, new Map());
        }
        const providerStatus = this.fileProviderStatus.get(filePath)!;

        // Update this provider's progress
        providerStatus.set(providerId, progress >= 1.0);

        // Calculate average progress across all active providers
        const activeProviders = Array.from(this.providers.entries())
            .filter(([_, provider]) => provider.isReady())
            .map(([id, _]) => id);
        
        let totalProgress = 0;
        let providerCount = 0;

        for (const id of activeProviders) {
            if (providerStatus.has(id)) {
                totalProgress += providerStatus.get(id) === true ? 1.0 : 0;
                providerCount++;
            }
        }

        // Update overall file progress (average across providers)
        const averageProgress = providerCount > 0 ? totalProgress / providerCount : 0;
        this.fileProgress.set(filePath, averageProgress);
    }

    /**
     * Check if all providers have completed processing
     */
    private checkAllComplete(): void {
        if (this.providers.size === 0 || !this.processing) {
            return;
        }

        const allComplete = Array.from(this.providers.values()).every(provider => {
            const tasks = provider.getTasksStatus();
            if (tasks.size === 0) return true;
            return Array.from(tasks.values()).every(task => {
                return task.status === 'completed' ||
                       task.status === 'failed' ||
                       task.status === 'cancelled'
            });
        });

        if (allComplete) {
            this.processing = false;
            this.emitter.emit('complete');
        }
    }
}