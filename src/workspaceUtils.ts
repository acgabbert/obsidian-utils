import { App, ButtonComponent, MarkdownView, Plugin, TFile, Workspace } from "obsidian";
import { CyberPlugin } from "./cyberPlugin";

export { addButtonContainer, addButtonToContainer, getActiveNoteContent };

function addButtonContainer(workspace: Workspace, file: TFile, className: string, rootFolder?: string) {
    /**
     * Add a button container HTML element to the active note
     * @param workspace the current Obsidian Workspace
     * @param file the current note
     * @param className the name of the button container class
     * @rootFolder the folder under which to add button containers (optional)
     * if not passed, the button container will be added to all notes
     */
    const view = workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const container = view.containerEl;
    if (!container) return;
    const els = container.getElementsByClassName(className);
    if (els && els.length > 0) {
        Array.from(els).forEach((el: Element, index: number, array: Element[]) => {
            container.removeChild(el);
        });
    }
    if (rootFolder && !file.path.includes(rootFolder)) {
        return;
    }
    const header = container.querySelector('.view-header');
    if (!header) return;
    const newDiv = document.createElement('div');
    newDiv.className = className;
    container.insertAfter(newDiv, header)
    return newDiv;
}

function addButtonToContainer(el: HTMLElement, buttonText: string): ButtonComponent {
    /**
     * add a button to the passed HTML element
     * @param el the parent HTML element under which the button will be created
     * @param buttonText the display text for the button
     * @returns the newly created button component
     */
    const button = new ButtonComponent(el)
        .setButtonText(buttonText);
    return button;
}

async function getActiveNoteContent(app: App): Promise<string | null> {
    /**
     * Get the contents of the active note via the vault cache
     * @param app the current Obsidian App instance
     * @returns a promise with the contents of the file, or null
     */
    const file = app.workspace.getActiveFile();
    if (!file) return null;
    return await app.vault.cachedRead(file);
}

async function toggleView(type: string, plugin: CyberPlugin): Promise<void> {
    /**
     * Activate a view of the given type in the right sidebar.
     * If the sidebar is not already open, open it and show the given view type.
     * If the sidebar is already open, show the given view type.
     * If the sidebar is open, and the given view type is active, collapse the sidebar.
     * @param type a view type
     */
    const {workspace} = plugin.app;
    let revealed = false;
    let leaf = plugin.sidebarContainers?.get(type) || workspace.getLeavesOfType(type).first() || null;
    if (!leaf) {
        leaf = workspace.getRightLeaf(false);
    }
    if (!leaf) return;
    revealed = !workspace.rightSplit.collapsed && leaf.getViewState().type == type;
    await leaf.setViewState({type: type, active: true});
    plugin.sidebarContainers?.set(type, leaf);
    if (revealed) workspace.rightSplit.collapse();
    else await workspace.revealLeaf(plugin.sidebarContainers?.get(type)!);
}