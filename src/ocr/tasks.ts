import { ParsedIndicators } from "../iocParser";

/**
 * Status of an OCR processing task
 */
export type OcrTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Represents a single OCR processing task
 */
export interface OcrTask {
    id: string;
    filePath: string;
    status: OcrTaskStatus;
    progress: number; // 0-100
    result?: string;
    indicators?: ParsedIndicators[];
    error?: Error;
}

/**
 * Progress reporting callback type
 */
export type ProgressCallback = (
    overallProgress: number,
    completedTasks: number,
    totalTasks: number,
    currentTask?: OcrTask
) => void;