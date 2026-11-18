/**
 * Page object for the TinkerItems search sidebar (AdvancedItemSearch).
 *
 * Drives the real PrimeVue widgets the way a user does: typing, picking
 * dropdown options from the overlay, ticking checkboxes, clicking buttons.
 * Mount with `appGlobals()` from ./app-globals and `attachTo: document.body`:
 * dropdown options render in an overlay teleported to the document body.
 */

import { flushPromises, type DOMWrapper, type VueWrapper } from '@vue/test-utils';

type Wrapper = VueWrapper | DOMWrapper<Element>;

/** The first button whose visible text is exactly `label`. */
export function findButton(wrapper: Wrapper, label: string): DOMWrapper<HTMLButtonElement> {
  const button = wrapper
    .findAll<HTMLButtonElement>('button')
    .find((candidate) => candidate.text().trim() === label);
  if (!button) throw new Error(`No button labelled "${label}"`);
  return button;
}

/** Click a button by its visible text and let the resulting work settle. */
export async function clickButton(wrapper: Wrapper, label: string): Promise<void> {
  await findButton(wrapper, label).trigger('click');
  await flushPromises();
}

/** Open a PrimeVue Dropdown and pick the option with the given label. */
export async function chooseOption(dropdown: DOMWrapper<Element>, option: string): Promise<void> {
  await dropdown.trigger('click');
  await flushPromises();
  const item = Array.from(document.body.querySelectorAll<HTMLElement>('li.p-dropdown-item')).find(
    (candidate) => candidate.getAttribute('aria-label') === option
  );
  if (!item) throw new Error(`Dropdown has no option "${option}"`);
  item.click();
  await flushPromises();
}

/** The value a PrimeVue Dropdown currently shows. */
export function shownOption(dropdown: DOMWrapper<Element>): string {
  return dropdown.find('.p-dropdown-label').text().trim();
}

type LabelledDropdown =
  | 'Item Class'
  | 'Equipment Slot'
  | 'Profession'
  | 'Breed'
  | 'Gender'
  | 'Faction';

export function itemSearchForm(wrapper: Wrapper) {
  const root = () => wrapper.find('.advanced-item-search');

  function nameInput(): DOMWrapper<HTMLInputElement> {
    return root().find<HTMLInputElement>('input[placeholder="Search for items..."]');
  }

  function qlInputs(): DOMWrapper<HTMLInputElement>[] {
    return root().findAll<HTMLInputElement>('.ql-input input');
  }

  /** The Dropdown under a field label such as "Item Class". */
  function dropdown(label: LabelledDropdown): DOMWrapper<Element> {
    const field = root()
      .findAll('label')
      .find((candidate) => candidate.text().trim() === label);
    const container = field?.element.parentElement;
    const match = root()
      .findAll('.p-dropdown')
      .find((candidate) => container?.contains(candidate.element));
    if (!match) throw new Error(`No "${label}" dropdown`);
    return match;
  }

  /** Match type and search field dropdowns sit unlabelled under the name box. */
  function nameDropdowns(): DOMWrapper<Element>[] {
    return root().findAll('.p-dropdown').slice(0, 2);
  }

  async function setQL(input: DOMWrapper<HTMLInputElement>, value: number): Promise<void> {
    await input.setValue(String(value));
    await input.trigger('blur');
    await flushPromises();
  }

  /** The checkbox whose label reads `label` ("Froob Friendly", "Strength", ...). */
  function checkbox(label: string): DOMWrapper<HTMLInputElement> {
    const field = root()
      .findAll('label')
      .find((candidate) => candidate.text().trim() === label);
    const id = field?.attributes('for');
    if (!id) throw new Error(`No checkbox labelled "${label}"`);
    return root().find<HTMLInputElement>(`input#${id}`);
  }

  return {
    nameInput,
    qlInputs,
    dropdown,
    searchButton: () => findButton(root(), 'Search'),
    clearButton: () => findButton(root(), 'Clear'),
    checkbox,

    async typeName(text: string): Promise<void> {
      await nameInput().setValue(text);
    },
    async pressEnter(): Promise<void> {
      await nameInput().trigger('keydown', { key: 'Enter' });
      await flushPromises();
    },
    async setMinQL(value: number): Promise<void> {
      await setQL(qlInputs()[0], value);
    },
    async setMaxQL(value: number): Promise<void> {
      await setQL(qlInputs()[1], value);
    },
    async quickQL(range: '1-50' | '51-100' | '101-200' | '201-300'): Promise<void> {
      await clickButton(root(), range);
    },
    async choose(label: LabelledDropdown, option: string): Promise<void> {
      await chooseOption(dropdown(label), option);
    },
    async matchType(option: 'Exact Match' | 'Fuzzy Search'): Promise<void> {
      await chooseOption(nameDropdowns()[0], option);
    },
    async searchIn(option: 'Both' | 'Item Name' | 'Description'): Promise<void> {
      await chooseOption(nameDropdowns()[1], option);
    },
    async tick(label: string, checked = true): Promise<void> {
      await checkbox(label).setValue(checked);
    },
    async search(): Promise<void> {
      await clickButton(root(), 'Search');
    },
    async clear(): Promise<void> {
      await clickButton(root(), 'Clear');
    },
  };
}
