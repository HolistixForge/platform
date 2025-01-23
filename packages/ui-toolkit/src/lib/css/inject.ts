//
//

let Stylesheet: CSSStyleSheet | null = null;

export const injectCssClass = (cssClass: string) => {
  if (Stylesheet === null) {
    const styleEl = document.createElement('style');
    document.head.appendChild(styleEl);
    Stylesheet = styleEl.sheet;
  }
  Stylesheet && Stylesheet.insertRule(cssClass /*, 0*/);
};
