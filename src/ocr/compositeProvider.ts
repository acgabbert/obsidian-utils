import { App } from "obsidian";
import { OcrProvider } from "./provider";
import { OcrTask, ProgressCallback } from "./tasks";
import { ParsedIndicators } from "../searchSites";

/**
 * A composite OCR provider that delegates OCR processing to multiple providers.
 * Results from all providers are combined transparently.
 */
export class CompositeOcrProvider implements OcrProvider {
    private providers: Map<string, OcrProvider> = new Map();
    private progressCallback: ProgressCallback | null = null;
    private aggregatedProgress: Map<string, { completed: number, total: number }> = new Map();
    
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
     * Process files with all active providers and combine results
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
        
        // Process files with all providers in parallel
        const providerResults = new Map<string, Promise<Map<string, ParsedIndicators[]>>>();
        
        for (const [id, provider] of this.providers.entries()) {
            if (provider.isReady()) {
                providerResults.set(id, provider.processFiles(app, filePaths));
                this.aggregatedProgress.set(id, { completed: 0, total: filePaths.length });
            }
        }
        
        // Combine results from all providers as they complete
        const combinedResults = new Map<string, ParsedIndicators[]>();
        
        // Wait for all providers to complete and process results
        const providerIds = Array.from(providerResults.keys());
        for (const id of providerIds) {
            try {
                console.log(`analyzing ${id}`)
                const results = await providerResults.get(id)!;
                
                for (const [filePath, indicators] of results.entries()) {
                    if (!combinedResults.has(filePath)) {
                        combinedResults.set(filePath, []);
                    }
                    
                    // Add indicators from this provider to the combined results
                    combinedResults.get(filePath)!.push(...indicators);
                }
            } catch (error) {
                console.error(`Error processing files with provider ${id}:`, error);
                // Update progress to indicate failure
                this.aggregatedProgress.set(id, { completed: 0, total: filePaths.length });
                this.updateOverallProgress();
            }
        }
        
        return combinedResults;
    }
    
    /**
     * Add files to the processing queue of all providers
     * @param app the Obsidian app instance
     * @param filePaths Array of file paths to add
     */
    addFiles(app: App, filePaths: string[]): void {
        for (const [id, provider] of this.providers.entries()) {
            if (provider.isReady()) {
                provider.addFiles(app, filePaths);
                
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
        return this.progressCallback;
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