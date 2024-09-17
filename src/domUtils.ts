import { Setting } from "obsidian";

export { datePickerSettingEl, openDetails, removeElements }

/**
 * remove a collection of elements
 * as commonly returned by `getElementsByClassName`
 * @param els a collection of HTML elements
 */
function removeElements(els: HTMLCollectionOf<Element>) {
    if (els && els.length > 0) {
        Array.from(els).forEach((el: Element, index: number, array: Element[]) => {
            try {
                el.parentNode?.removeChild(el);
            } catch { }
        });
    }
}

/**
 * Open a collection of Details elements
 * @param els the collection of elements to be opened
 */
function openDetails(els: HTMLCollectionOf<HTMLDetailsElement>) {
    if (els && els.length > 0) {
        Array.from(els).forEach((el: HTMLDetailsElement) => {
            try {
                el.open = true;
            } catch { }
        });
    }
}

/**
 * Add a date picker "setting"
 * @param parentEl the parent element to which the date picker will be added
 * @param value the default value of the date picker (optional)
 * @param name the display name for the date picker element (optional)
 * @returns the date picker element
 */
function datePickerSettingEl(parentEl: HTMLElement, value?: string, name?: string): HTMLInputElement {
    value = value || new Date(Date.now()).toISOString();
    name = name || 'Date Picker';
    const fromDate = new Setting(parentEl).setName(name).settingEl;
    const fromDateEl = document.createElement("input");
    fromDateEl.setAttribute("type", "datetime-local");
    fromDateEl.setAttribute("value", value)
    fromDate.appendChild(fromDateEl);
    return fromDateEl;
}