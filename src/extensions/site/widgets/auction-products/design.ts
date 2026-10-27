// Per-element style overrides for the custom element widget. Each element maps to
// the global part class the shared Auction Products component already renders.

export type DesignProperty = 'font' | 'color' | 'background';

export type ElementDesign = {
  font?: string;
  textDecoration?: string;
  color?: string;
  background?: string;
};

export type WidgetDesign = Record<string, ElementDesign>;

export type DesignElement = {
  id: string;
  label: string;
  className: string;
  properties: DesignProperty[];
};

const TEXT: DesignProperty[] = ['font', 'color'];
const CONTROL: DesignProperty[] = ['font', 'color', 'background'];
const SURFACE: DesignProperty[] = ['background'];

export const DESIGN_ELEMENTS: DesignElement[] = [
  { id: 'root', label: 'Widget background', className: 'auction-products', properties: SURFACE },
  { id: 'header', label: 'Header', className: 'auction-products-header', properties: SURFACE },
  { id: 'title', label: 'Title', className: 'auction-products-title', properties: TEXT },
  { id: 'subtitle', label: 'Subtitle', className: 'auction-products-subtitle', properties: TEXT },
  { id: 'search', label: 'Search box', className: 'auction-products-search', properties: CONTROL },
  { id: 'auctionFilter', label: 'Auction filter', className: 'auction-products-auction-filter', properties: CONTROL },
  { id: 'timerFilter', label: 'Timer filter', className: 'auction-products-timer-filter', properties: CONTROL },
  { id: 'card', label: 'Product card', className: 'auction-products-card', properties: SURFACE },
  { id: 'statusBadge', label: 'Status badge', className: 'auction-products-status-badge', properties: CONTROL },
  { id: 'productName', label: 'Product name', className: 'auction-products-product-name', properties: TEXT },
  { id: 'metaLabel', label: 'Price label', className: 'auction-products-meta-label', properties: TEXT },
  { id: 'metaValue', label: 'Price value', className: 'auction-products-meta-value', properties: TEXT },
  { id: 'timing', label: 'Countdown', className: 'auction-products-timing', properties: TEXT },
  { id: 'bidButton', label: 'Bid button', className: 'auction-products-bid-button', properties: CONTROL },
  { id: 'carouselArrow', label: 'Carousel arrows', className: 'auction-products-carousel-arrow', properties: CONTROL },
  { id: 'loadMoreButton', label: 'Load more button', className: 'auction-products-load-more-button', properties: CONTROL },
  { id: 'emptyTitle', label: 'Empty state title', className: 'auction-products-empty-title', properties: TEXT },
  { id: 'emptyDescription', label: 'Empty state text', className: 'auction-products-empty-description', properties: TEXT },
  { id: 'bidDialog', label: 'Bid dialog', className: 'auction-products-bid-dialog', properties: SURFACE },
  { id: 'dialogProductName', label: 'Dialog product name', className: 'auction-products-dialog-product-name', properties: TEXT },
  { id: 'dialogTitle', label: 'Dialog title', className: 'auction-products-dialog-title', properties: TEXT },
  { id: 'closeButton', label: 'Dialog close button', className: 'auction-products-close-button', properties: CONTROL },
  { id: 'fieldLabel', label: 'Field labels', className: 'auction-products-field-label', properties: TEXT },
  { id: 'dialogInput', label: 'Bid input', className: 'auction-products-dialog-input', properties: CONTROL },
  { id: 'helperText', label: 'Helper text', className: 'auction-products-helper-text', properties: TEXT },
  { id: 'submitButton', label: 'Submit bid button', className: 'auction-products-submit-button', properties: CONTROL },
];

export function parseDesign(value: string | null | undefined): WidgetDesign {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Values come from the Editor pickers, but they are written into a <style> tag,
// so drop anything that could close the declaration or the rule.
function cssValue(value: string | undefined): string | null {
  const cleaned = value?.replace(/[{}<>;]/g, '').trim();
  return cleaned ? cleaned : null;
}

export function buildDesignCss(scopeSelector: string, design: WidgetDesign): string {
  return DESIGN_ELEMENTS.map((element) => {
    const values = design[element.id];
    if (!values) return '';

    const declarations = [
      ['font', cssValue(values.font)],
      ['text-decoration', cssValue(values.textDecoration)],
      ['color', cssValue(values.color)],
      ['background', cssValue(values.background)],
    ]
      .filter(([, value]) => value)
      .map(([property, value]) => `${property}: ${value};`)
      .join(' ');

    if (!declarations) return '';
    // Scope attribute + part class outranks the component's single-class module rules.
    return `${scopeSelector} .${element.className} { ${declarations} }`;
  })
    .filter(Boolean)
    .join('\n');
}
