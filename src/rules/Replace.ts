import { Rule } from './Rule';
import { Book } from '../book';
import { PageMaker, CSSSelector } from '../types';

export interface ReplaceRuleOptions {
  selector: CSSSelector;
  replace: (element: HTMLElement, info?: any) => HTMLElement;
}

class Replace extends Rule {
  constructor(options: Partial<ReplaceRuleOptions>) {
    super(options);
    this.name = 'Replace';
  }
  afterAdd(
    element: HTMLElement,
    book: Book,
    continueOnNewPage: Function,
    makeNewPage: PageMaker,
    overflowCallback: Function,
  ) {
    const parent = element.parentNode;
    if (!parent) {
      console.error(element);
      throw Error(
        `Bindery.Replace({ selector: '${this.selector}' }).afterAdd called on element that hasn't been added.`,
      );
    }
    const defensiveClone = element.cloneNode(true) as HTMLElement;
    const replacement = this.createReplacement(book, defensiveClone);
    parent.replaceChild(replacement, element);

    if (book.currentPage.hasOverflowed()) {
      parent.replaceChild(element, replacement);

      return overflowCallback(element);
    }

    return replacement;
  }
  createReplacement(book: Book, element: HTMLElement) {
    return this.replace(element);
  }
  replace(element: HTMLElement, info?: any) {
    element.insertAdjacentHTML(
      'beforeend',
      '<sup class="bindery-sup">Default Replacement</sup>',
    );
    return element;
  }
}

export default Replace;
