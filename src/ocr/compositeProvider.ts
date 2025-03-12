import { App } from "obsidian";
import { EventEmitter } from "events";
import { OcrProvider, ParallelOcrProvider } from "./provider";
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
    private resultsCallback: ResultsCallback | null = null;
    private aggregatedProgress: Map<string, { completed: number, total: number }> = new Map();
    private processing: boolean = false;
    
    /**
     * Add an OCR provider to the composite
     * @param id A unique identifier for the provider
     * @param provider The provider to add
     */
    addProvider(id: string, provider: OcrProvider): void {
        if (this.providers.has(id)) {
            throw new Error(`Provider with ID "${id}" already exists`);
        }
        
        // Wrap the provider's progress callback to track progress
        provider.setProgressCallback((overallProgress, completedTasks, totalTasks, currentTask) => {
            // Store the progress for this provider
            this.aggregatedProgress.set(id, { completed: completedTasks, total: totalTasks });
            
            // Update the overall progress
            this.updateOverallProgress(currentTask);
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
        this.aggregatedProgress.delete(id);
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
        this.aggregatedProgress.clear();
        
        if (this.providers.size === 0) {
            return new Map();
        }
        
        this.processing = true;
        
        // Initialize combined results map
        const combinedResults = new Map<string, ParsedIndicators[]>();
        for (const filePath of filePaths) {
            combinedResults.set(filePath, []);
        }
        
        try {
            // Process files with all providers in parallel and collect promises
            const providerPromises: Promise<void>[] = [];
            
            for (const [id, provider] of this.providers.entries()) {
                if (provider.isReady()) {
                    // Create a proxy for tracking incremental results for this provider
                    this.createProviderProxy(id, provider, app, filePaths, combinedResults);
                    this.aggregatedProgress.set(id, { completed: 0, total: filePaths.length });
                }
            }
            
            // Wait for all proxied processing to complete
            await Promise.all(providerPromises);
            
            return combinedResults;
        } finally {
            this.processing = false;
        }
    }
    
    /**
     * Creates a proxy for a provider to track and report its results incrementally
     */
    private createProviderProxy(
        providerId: string,
        provider: OcrProvider,
        app: App,
        filePaths: string[],
        combinedResults: Map<string, ParsedIndicators[]>
    ): void {
        // Set up result tracking for this provider
        const originalCallback = provider.getProgressCallback();
        
        // Create task tracker for this provider
        const tasksMap = new Map<string, OcrTask>();
        
        // Create a task completion observer
        const taskObserver = (task?: OcrTask) => {
            if (!task || task.status !== 'completed' || !task.indicators) {
                return;
            }
            
            // Store the task by ID for tracking
            tasksMap.set(task.id, task);
            
            // Report the new results
            const filePath = task.filePath;
            const indicators = task.indicators;
            
            // Add to combined results
            if (combinedResults.has(filePath)) {
                combinedResults.get(filePath)!.push(...indicators);
            } else {
                combinedResults.set(filePath, [...indicators]);
            }
            
            // Emit event and call callback
            this.emitter.emit('result', filePath, indicators, providerId);
            if (this.resultsCallback) {
                this.resultsCallback(filePath, indicators, providerId);
            }
        };
        
        // Set up a progress callback wrapper to catch completed tasks
        const progressWrapper: ProgressCallback = (
            overallProgress, completedTasks, totalTasks, currentTask
        ) => {
            // Update aggregated progress
            this.aggregatedProgress.set(providerId, { completed: completedTasks, total: totalTasks });
            this.updateOverallProgress(currentTask);
            
            // Check for completed tasks
            if (currentTask && currentTask.status === 'completed' && currentTask.indicators) {
                taskObserver(currentTask);
            }
            
            // Call original callback if it exists
            if (originalCallback) {
                originalCallback(overallProgress, completedTasks, totalTasks, currentTask);
            }
        };
        
        // Apply the wrapped callback
        provider.setProgressCallback(progressWrapper);
        
        // Start processing with the provider
        provider.addFiles(app, filePaths);
        
        // Also set up a task status checker to periodically check for completed tasks
        // This ensures we catch results even if the progress callback misses them
        const checkInterval = setInterval(() => {
            if (!this.processing) {
                clearInterval(checkInterval);
                return;
            }
            
            const tasks = provider.getTasksStatus();
            for (const [taskId, task] of tasks.entries()) {
                if (
                    task.status === 'completed' && 
                    task.indicators && 
                    !tasksMap.has(taskId)
                ) {
                    taskObserver(task);
                }
            }
        }, 100);
    }
    
    /**
     * Add files to the processing queue of all providers
     * @param app the Obsidian app instance
     * @param filePaths Array of file paths to add
     */
    addFiles(app: App, filePaths: string[]): void {
        // Initialize combined results map for these files
        const combinedResults = new Map<string, ParsedIndicators[]>();
        for (const filePath of filePaths) {
            combinedResults.set(filePath, []);
        }
        
        this.processing = true;
        
        for (const [id, provider] of this.providers.entries()) {
            if (provider.isReady()) {
                // Create proxy for this provider to track results
                this.createProviderProxy(id, provider, app, filePaths, combinedResults);
                
                // Update progress tracking for this provider
                this.aggregatedProgress.set(id, { 
                    completed: 0, 
                    total: (this.aggregatedProgress.get(id)?.total || 0) + filePaths.length 
                });
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
        
        this.aggregatedProgress.clear();
        
        // Report zero progress
        if (this.progressCallback) {
            this.progressCallback(0, 0, 0);
        }
    }
    
    /**
     * Set a callback for progress reporting
     * @param callback Function to call with progress updates
     */
    setProgressCallback(callback: ProgressCallback): void {
        this.progressCallback = callback;
    }
    
    /**
     * Get the current progress callback
     * @returns The current progress callback function or null if none is set
     */
    getProgressCallback(): ProgressCallback | null {
        return this.progressCallback ?? null;
    }
    
    /**
     * Set a callback for incremental results reporting
     * @param callback Function to call when new results are available
     */
    setResultsCallback(callback: ResultsCallback): void {
        this.resultsCallback = callback;
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
    on(event: string, listener: (...args: any[]) => void): void {
        this.emitter.on(event, listener);
    }
    
    /**
     * Unsubscribe from result events
     * @param event Event name
     * @param listener Callback function
     */
    off(event: string, listener: (...args: any[]) => void): void {
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
        if (!this.progressCallback) {
            return;
        }
        
        let totalCompleted = 0;
        let totalTasks = 0;
        
        for (const progress of this.aggregatedProgress.values()) {
            totalCompleted += progress.completed;
            totalTasks += progress.total;
        }
        
        const overallProgress = totalTasks > 0 ? totalCompleted / totalTasks : 0;
        
        this.progressCallback(overallProgress, totalCompleted, totalTasks, currentTask);
    }
}