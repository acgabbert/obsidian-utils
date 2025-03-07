import { App, Plugin, TFile } from "obsidian";
import { OcrTask, ProgressCallback } from "./tasks";
import { ParsedIndicators } from "../searchSites";

/**
 * Interface for OCR providers that process files and extract indicators
 */
export interface OcrProvider {
    /**
     * Process a list of files and extract indicators from each
     * @param app the Obsidian app instance
     * @param filePaths Array of file paths to process
     * @returns Promise that resolves to a map of filePath to extracted indicators
     */
    processFiles(app: App, filePaths: string[]): Promise<Map<string, ParsedIndicators[]>>;

    /**
     * Add files to the processing queue
     * @param app the Obsidian app instance
     * @param filePaths Array of file paths to add
     */
    addFiles(app: App, filePaths: string[]): void;

    /**
     * Cancel all ongoing OCR operations
     */
    cancel(): void;

    /**
     * Set a callback for progress reporting
     * @param callback Function to call with progress updates
     */
    setProgressCallback(callback: ProgressCallback): void;

    /**
     * Check if the provider is ready to process files
     * @returns boolean indicating if the provider is ready
     */
    isReady(): boolean;

    /**
     * Get the current status of all tasks
     * @returns Map of task IDs to task objects
     */
    getTasksStatus(): Map<string, OcrTask>;

    /**
     * Get the current progress callback
     * @returns The current progress callback function or null if none is set
     */
    getProgressCallback(): ProgressCallback | null;
}

/**
 * Base abstract class for OCR providers with common functionality
 */
export abstract class AbstractOcrProvider implements OcrProvider {
    protected tasks: Map<string, OcrTask> = new Map();
    protected abortController: AbortController = new AbortController();
    protected processingPromise: Promise<void> | null = null;
    protected progressCallback?: ProgressCallback;
    protected matchExtractor: (text: string) => Promise<ParsedIndicators[]>;

    constructor(matchExtractor: (text: string) => Promise<ParsedIndicators[]>) {
        this.matchExtractor = matchExtractor;
    }

    abstract processFiles(app: App, filePaths: string[]): Promise<Map<string, ParsedIndicators[]>>;
    abstract addFiles(app: App, filePaths: string[]): void;
    abstract isReady(): boolean;

    /**
     * Cancel all ongoing OCR operations
     */
    cancel(): void {
        this.abortController.abort();
        this.abortController = new AbortController();
        this.processingPromise = null;
        
        // Mark all processing tasks as cancelled
        for (const task of this.tasks.values()) {
            if (task.status === 'processing' || task.status === 'pending') {
                task.status = 'cancelled';
                this.updateProgress(task);
            }
        }

        this.tasks.clear();

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
     * Get the current status of all tasks
     * @returns Map of task IDs to task objects
     */
    getTasksStatus(): Map<string, OcrTask> {
        return new Map(this.tasks);
    }

    /**
     * Generate a unique task ID
     * @returns Unique task ID string
     */
    protected generateTaskId(): string {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    }

    /**
     * Update the progress of a task and trigger progress callback
     * @param task The task to update progress for
     */
    protected updateProgress(task: OcrTask): void {
        if (!this.progressCallback) return;
        
        // Calculate overall progress
        let totalProgress = 0;
        let completedTasks = 0;
        const totalTasks = this.tasks.size;
        
        for (const t of this.tasks.values()) {
            totalProgress += t.progress;
            if (t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled') {
                completedTasks++;
            }
        }
        
        const overallProgress = totalTasks > 0 ? totalProgress / totalTasks : 0;
        this.progressCallback(overallProgress, completedTasks, totalTasks, task);
    }

    /**
     * Get the current progress callback
     * @returns The current progress callback function or null if none is set
     */
    getProgressCallback(): ProgressCallback | null {
        return this.progressCallback || null;
    }
}

/**
 * OCR Provider that supports parallel processing of files
 */
export class ParallelOcrProvider extends AbstractOcrProvider {
    private maxConcurrent: number;
    private processingCount: number = 0;
    private ocrProcessor: (app: App, file: TFile, signal: AbortSignal) => Promise<string>;

    /**
     * Creates a new ParallelOcrProvider
     * @param ocrProcessor A function that processes a file and returns text
     * @param matchExtractor A function that extracts indicators from text
     * @param maxConcurrent Maximum number of concurrent OCR operations
     */
    constructor(
        ocrProcessor: (app: App, file: TFile, signal: AbortSignal) => Promise<string>,
        matchExtractor: (text: string) => Promise<ParsedIndicators[]>,
        maxConcurrent: number = 4
    ) {
        super(matchExtractor);
        this.ocrProcessor = ocrProcessor;
        this.maxConcurrent = maxConcurrent;
    }

    /**
     * Process files and extract indicators
     * @param app the Obsidian app instance
     * @param filePaths Array of file paths to process
     * @returns Promise that resolves to a map of filePath to extracted indicators
     */
    async processFiles(app: App, filePaths: string[]): Promise<Map<string, ParsedIndicators[]>> {
        // Add files to the queue
        this.addFiles(app, filePaths);
        
        // Wait for processing to complete
        if (this.processingPromise) {
            await this.processingPromise;
        }
        
        // Collect results
        const results = new Map<string, ParsedIndicators[]>();
        for (const task of this.tasks.values()) {
            if (task.status === 'completed' && task.indicators) {
                results.set(task.filePath, task.indicators);
            }
        }
        
        return results;
    }

    /**
     * Add files to the processing queue
     * @param app the Obsidian app instance
     * @param filePaths Array of file paths to add
     */
    addFiles(app: App, filePaths: string[]): void {
        // Add files to tasks
        for (const filePath of filePaths) {
            const taskId = this.generateTaskId();
            this.tasks.set(taskId, {
                id: taskId,
                filePath,
                status: 'pending',
                progress: 0
            });
        }
        
        // Start processing if not already running
        if (!this.processingPromise) {
            this.processingPromise = this.processQueue(app);
        }
    }

    /**
     * Check if provider is ready to process files
     * @returns boolean indicating if the provider is ready
     */
    isReady(): boolean {
        return true; // Override in subclasses if needed
    }

    /**
     * Process the queue of tasks with parallel execution
     * @param app the Obsidian app instance
     */
    private async processQueue(app: App): Promise<void> {
        try {
            // keep processing until no pending tasks remain
            while (this.hasPendingTasks()) {
                const pendingTasks: OcrTask[] = [];
                const availableSlots = this.maxConcurrent - this.processingCount;

                if (availableSlots > 0) {
                    for (const task of this.tasks.values()) {
                        if (task.status === 'pending') {
                            pendingTasks.push(task);
                            if (pendingTasks.length >= availableSlots) break;
                        }
                    }
                    
                    // Start processing collected tasks
                    for (const task of pendingTasks) {
                        this.processingCount++;
                        task.status = 'processing';
                        this.updateProgress(task);
                        
                        // process task asynchronously without awaiting
                        this.processTask(app, task).finally(() => {
                            this.processingCount--;
                        });
                    }
                }

                // if we couldn't start any new tasks, wait a bit before checking again
                if (pendingTasks.length === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
            
            // Wait for all processing tasks to complete
            while (this.processingCount > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } finally {
            this.processingPromise = null;
        }
    }

    /**
     * Process a single OCR task
     * @param app the Obsidian app instance
     * @param task the task to process
     */
    private async processTask(app: App, task: OcrTask): Promise<void> {
        try {
            // Get the file
            const file = app.vault.getFileByPath(task.filePath);
            if (!file) {
                throw new Error(`File not found: ${task.filePath}`);
            }
            
            // Update progress to indicate file found
            const currentTask = this.tasks.get(task.id);
            if (!currentTask || currentTask.status === 'cancelled') return;
            
            currentTask.progress = 10;
            this.updateProgress(currentTask);
            
            // Process OCR with cancellation support
            const text = await this.ocrProcessor(app, file, this.abortController.signal);
            
            // Check if cancelled
            if (this.abortController.signal.aborted) {
                currentTask.status = 'cancelled';
                this.updateProgress(currentTask);
                return;
            }
            
            // Update progress after OCR
            currentTask.progress = 70;
            currentTask.result = text;
            this.updateProgress(currentTask);
            
            // Extract indicators
            const indicators = await this.matchExtractor(text);
            
            // Update final results
            currentTask.progress = 100;
            currentTask.status = 'completed';
            currentTask.indicators = indicators;
            this.updateProgress(currentTask);
            
        } catch (error) {
            // Handle errors
            const currentTask = this.tasks.get(task.id);
            if (currentTask && currentTask.status !== 'cancelled') {
                currentTask.status = 'failed';
                currentTask.error = error instanceof Error ? error : new Error(String(error));
                this.updateProgress(currentTask);
            }
        }
    }

    /**
     * Check if there are any pending tasks
     * @returns boolean indicating if there are pending tasks
     */
    private hasPendingTasks(): boolean {
        for (const task of this.tasks.values()) {
            if (task.status === 'pending') return true;
        }
        return false;
    }

    /**
     * Get the next pending task
     * @returns The next pending task or undefined if none
     */
    private getNextPendingTask(): OcrTask | undefined {
        for (const task of this.tasks.values()) {
            if (task.status === 'pending') return task;
        }
        return undefined;
    }
}

/**
 * Empty OCR provider that does nothing
 */
export class EmptyOcrProvider implements OcrProvider {
    private progressCallback: ProgressCallback | null = null;

    processFiles(app: App, filePaths: string[]): Promise<Map<string, ParsedIndicators[]>> {
        return Promise.resolve(new Map());
    }
    
    addFiles(app: App, filePaths: string[]): void {
        // Do nothing
    }
    
    cancel(): void {
        // Do nothing
    }
    
    setProgressCallback(callback: ProgressCallback): void {
        this.progressCallback = callback;
    }

    getProgressCallback(): ProgressCallback | null {
        return this.progressCallback || null;
    }
    
    isReady(): boolean {
        return false;
    }
    
    getTasksStatus(): Map<string, OcrTask> {
        return new Map();
    }
}