import { App, TFile } from "obsidian";
import { OcrProvider, OcrProviderEvent, ParallelOcrProvider } from "./provider";
import { OcrTask } from "./tasks";

export { encodeImageFile, readImageFile }

/**
 * Reads the contents of an image file into a Buffer.
 * @param app Obsidian app instance
 * @param file an Obsidian TFile
 * @returns the image in a Buffer format
 */
async function readImageFile(app: App, file: TFile): Promise<Buffer> {
    const arrBuff = await app.vault.readBinary(file);
    const buffer = Buffer.from(arrBuff);
    return buffer;
}

/**
 * base64 encodes an image file
 * @param app Obsidian app instance
 * @param file an Obsidian TFile
 * @returns the base64-encoded image
 */
async function encodeImageFile(app: App, file: TFile): Promise<string> {
    return (await readImageFile(app, file)).toString('base64');
}

/**
 * Add event tracking to help debug duplicate processing issues
 */
export function addEventTracking(provider: OcrProvider): void {
    // Track which files have been processed
    const processedFiles = new Set<string>();
    
    // Store original event emitter function
    const originalOn = provider.on;
    
    // Wrap result event handler to track duplicates
    provider.on = function(event: OcrProviderEvent, listener: (...args: any[]) => void): void {
        if (event === 'result') {
            return originalOn.call(this, event, (filePath: string, indicators: any, providerId?: string) => {
                // Check for duplicate results
                if (processedFiles.has(filePath)) {
                    console.warn(`DUPLICATE DETECTION: Already processed ${filePath} from ${providerId || 'unknown'}`);
                } else {
                    processedFiles.add(filePath);
                    console.log(`First time processing ${filePath} from ${providerId || 'unknown'}`);
                }
                
                // Call original listener
                return listener(filePath, indicators, providerId);
            });
        } else {
            return originalOn.call(this, event, listener);
        }
    };
}

/**
 * Utility for tracking task creation and processing
 */
export function trackTaskActivity(provider: OcrProvider | ParallelOcrProvider): void {
    // Track tasks by file path
    const tasksByFile = new Map<string, string[]>();
    
    // Intercept task creation
    const originalAddFiles = provider.addFiles;
    provider.addFiles = function(app: App, filePaths: string[]): void {
        console.log(`Provider.addFiles called with ${filePaths.length} files:`, filePaths);
        
        // Check for duplicates in current tasks
        const taskStatus = provider.getTasksStatus();
        const existingFiles = new Set(Array.from(taskStatus.values()).map(t => t.filePath));
        
        for (const file of filePaths) {
            if (existingFiles.has(file)) {
                console.warn(`DUPLICATE TASK: ${file} is already in the task queue`);
            }
        }
        
        return originalAddFiles.call(this, app, filePaths);
    };
    
    // Track task updates
    provider.on('taskUpdate', (task: OcrTask) => {
        // Initialize array for this file if needed
        if (!tasksByFile.has(task.filePath)) {
            tasksByFile.set(task.filePath, []);
        }
        
        // Add task ID if not already tracking it
        const tasks = tasksByFile.get(task.filePath)!;
        if (!tasks.includes(task.id)) {
            tasks.push(task.id);
            
            // Log if we have multiple tasks for the same file
            if (tasks.length > 1) {
                console.warn(`MULTIPLE TASKS: ${task.filePath} has ${tasks.length} tasks:`, tasks);
            }
        }
        
        // Log task status changes
        console.log(`Task ${task.id} for ${task.filePath} status: ${task.status}`);
    });
}