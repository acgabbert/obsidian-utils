import { TFile } from "obsidian";

export const App = jest.fn();
export const Plugin = jest.fn();
export const SuggestModal = jest.fn();
export const Modal = jest.fn();
export const ItemView = jest.fn();
export const request = jest.fn().mockReturnValue(`COM
ORG
ME
INFO`);
export const mockFile: TFile = {
    name: "file.md"
} as unknown as TFile;