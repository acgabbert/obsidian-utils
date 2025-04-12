import { TFile } from "obsidian";

export const App = jest.fn();
export const Plugin = jest.fn();
export const SuggestModal = jest.fn();
export const Modal = jest.fn();
export const ItemView = jest.fn();
/*
export const request = jest.fn().mockReturnValue(`COM
ORG
ME
INFO`);
*/
export const mockFile: TFile = {
    name: "file.md"
} as unknown as TFile;
export const Platform = {
    isDesktop: true
};// __mocks__/obsidian.ts

// This is the function we want to be able to spy on and control
const mockRequest = jest.fn();

// Export the mock function with the name 'request'
export const request = mockRequest;

// Export other things your code might import from 'obsidian' if necessary
// For example:
export class Notice {}
export interface RequestUrlParam {
    url: string;
    method?: string;
    contentType?: string;
    body?: string | ArrayBuffer;
    headers?: Record<string, string>;
    throw?: boolean;
    forceCors?: boolean;
}

// You can add more exports if your class uses other parts of the Obsidian API