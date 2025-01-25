import { Notice, Platform, Plugin } from "obsidian";

export { encryptString, decryptString, loadPrivateData, savePrivateData };

// @ts-ignore
let safeStorage: Electron.SafeStorage | null = null;

if (Platform.isDesktop) {
    // @ts-ignore
    safeStorage = require("electron")?.remote?.safeStorage;
}


/**
 * Encrypt a string using the Electron safe storage API.
 * @param val the string to be encrypted.
 * @returns the base64-encoded, encrypted string, or an empty string.
 */
function encryptString(val: string): string {
    if (Platform.isDesktop && safeStorage && safeStorage.isEncryptionAvailable()) {
        try {
            const buff = safeStorage.encryptString(val) as Buffer;
            return buff.toString("base64");
        } catch(err) {
            console.error(`Failed to encrypt passed value. ${err}`);
            new Notice("Failed to encrypt input string. Check console for error details.");
            return "";
        }
    }
    console.error(`Safe storage provider not available.`);
    new Notice("Failed to encrypt input string. Check console for error details.");
    return "";
}


/**
 * Decrypt a string using the Electron safe storage API.
 * @param val an encrypted value.
 * @returns the decrypted value, or an empty string.
 */
function decryptString(val: string): string {
    if (Platform.isDesktop && safeStorage && safeStorage.isEncryptionAvailable()) {
        try {
            const buff = Buffer.from(val, "base64");
            return safeStorage.decryptString(buff) as string;
        } catch(err) {
            console.error(`Failed to decrypt passed value. ${err}`);
            new Notice("Failed to decrypt input string. Check console for error details.");
            return "";
        }
    }
    console.error(`Safe storage provider not available.`);
    new Notice("Failed to decrypt input string. Check console for error details.");
    return "";
}


/**
 * Get the private data path for a plugin
 * @param plugin an Obsidian plugin
 * @returns the path of privateData.json within the plugin folder
 */
function getPrivateDataPath(plugin: Plugin): string {
    return `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}/privateData.json`;
}


/**
 * Save private data to privateData.json.
 * @param plugin an Obsidian plugin
 * @param data the private data to save
 */
async function savePrivateData(plugin: Plugin, data: Object): Promise<void> {
    try {
        const privateDataPath = getPrivateDataPath(plugin);
        const dataString = JSON.stringify(data, null, 2);
        await plugin.app.vault.adapter.write(privateDataPath, dataString);
    } catch(err) {
        console.error("Error saving private data.", err);
    }
}


/**
 * Load private data from privateData.json.
 * @param plugin an Obsidian plugin
 * @returns the plugin data contained in privateData.json
 */
async function loadPrivateData(plugin: Plugin): Promise<Object | null> {
    try {
        const privateDataPath = getPrivateDataPath(plugin);
        const fileExists = await plugin.app.vault.adapter.exists(privateDataPath);
        if (fileExists) {
            const data = await plugin.app.vault.adapter.read(privateDataPath);
            return JSON.parse(data);
        } else {
            return null;
        }
    } catch(err) {
        console.error("Error loading private data.", err);
        return null;
    }
}