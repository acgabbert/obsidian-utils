import { App, TFile, Vault } from 'obsidian';

export { 
    checkFolderExistsRecursive,
    createFolderIfNotExists,
    createNote,
    getAttachments,
    getAttachmentFiles,
    getBacklinks,
    noteAppend,
    noteReplace,
    openNote,
    removeDotObsidian
};

/**
 * Check if a given folder exists
 * @param rootPath the folder to start searching from
 * @returns folder name, blank if not exists
 */
async function checkFolderExistsRecursive(vault: Vault, folderName: string): Promise<string> {
    async function searchFolder(rootPath: string): Promise<string> {
        const checkVal = rootPath + "/" + folderName;
        const folderExists = await vault.adapter.exists(checkVal, true);
        if (folderExists) return folderName;
        const subFolders = (await vault.adapter.list(rootPath)).folders;
        // skip .obsidian config folder
        const i = subFolders.indexOf('.obsidian');
        //i > -1 ? subFolders.splice(i, 1) : {};
        if (i > -1) {
            subFolders.splice(i, 1);
        }
        for (const subFolder of subFolders) {
            const isSubFolder = await vault.adapter.exists(subFolder, true);
            if (isSubFolder) {
                const found = await searchFolder(subFolder);
                if (found && !found.startsWith(subFolder)) {
                    return `${subFolder}/${found}`;
                } 
                else if (found) return found;
            }
        }

        return "";
    }

    return await searchFolder("");
}


/**
 * Remove .obsidian config folder, .DS_Store file from a list of file/folder names
 * @param files an array of file/folder names
 * @returns the array with unnecessary files removed
 */
function removeDotObsidian(files: string[]): string[] {
    const removals = ['.obsidian', '.DS_Store'];
    removals.forEach((value) => {
        const i = files.indexOf(value);
        if (i > -1) {
            files.splice(i, 1);
        }
    })
    return files;
}

/**
 * Creates a folder if it does not already exist.
 * @param vault
 */
async function createFolderIfNotExists(vault: Vault, folderName: string) {
    const folder = await checkFolderExistsRecursive(vault, folderName);
    if (!folder) {
        await vault.createFolder(folderName);
    }
}

/**
 * Creates a note within the given vault.
 * @param vault
 * @param folderName
 * @param noteTitle
 * @returns the newly created note
 */
async function createNote(vault: Vault, folderName: string, noteTitle: string): Promise<TFile> {
    return await vault.create(`${folderName}/${noteTitle}.md`, '');
}

/**
 * Get an array of the unresolved backlinks in a note.
 * @param notePath the note to check
 * @param app the current App class instance
 * @param resolved whether or not you want resolved links
 * @returns an array of strings
 */
function getBacklinks(notePath: string, app: App, resolved = false): Array<string> {
    let backlinks = null;
    if (resolved) {
        backlinks = app.metadataCache.resolvedLinks[notePath];
    } else {
        backlinks = app.metadataCache.unresolvedLinks[notePath];
    }
    const retval = [];
    for (const i in backlinks) {
        retval.push(i);
    }
    return retval;
}

/**
 * Get an array of linked non-markdown (presumably attachment) files in a note.
 * @param notePath the path of the note to check for attachment links
 * @param app the current App class instance
 */
function getAttachments(notePath: string, app: App): Array<TFile> {
    const links = getBacklinks(notePath, app, true);
    const attachments = new Set<TFile>();
    links.forEach((link) => {
        const file = app.vault.getAbstractFileByPath(link);
        if (file && file instanceof TFile && file.extension !== "md") {
            attachments.add(file);
        }
    });
    return Array.from(attachments);
}

/**
 * Get an array of linked file objects from a note.
 * @param note the note to check for linked attachment files
 * @param app the current App class instance
 */
function getAttachmentFiles(note: TFile, app: App): TFile[] {
    const links = getBacklinks(note.path, app, true);
    const attachments = new Set<TFile>();
    links.forEach((link) => {
        const file = app.vault.getAbstractFileByPath(link);
        if (file && file instanceof TFile && file.extension !== "md") {
            attachments.add(file);
        }
    });
    return Array.from(attachments);
}

/**
 * Append to the end of a note
 * @param vault the current vault
 * @param note the note to append to
 * @param content the content to append
 * @returns the modified content
 */
function noteAppend(vault: Vault, note: TFile, content: string): Promise<string> {
    return vault.process(note, (data) => {
        return data + content;
    });
}

/**
 * Replace content in a note by regular expression
 * @param vault the current vault
 * @param note the note to append to
 * @param regex the pattern to match for replacement
 * @param content the content to replace with 
 * @returns the modified content
 */
function noteReplace(vault: Vault, note: TFile, regex: RegExp, content: string): Promise<string> {
    return vault.process(note, (data) => {
        return data.replace(regex, content);
    });
}

/**
 * Opens the note in a new tab
 * @param app the current App class instance
 * @param note the file you would like to open
 */
function openNote(app: App, note: TFile) {
    if (!note || !app) return;
    const view = app.workspace.getLeaf();
    view.openFile(note);
}