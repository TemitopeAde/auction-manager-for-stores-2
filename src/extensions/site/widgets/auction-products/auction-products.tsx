import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import AuctionProducts from '../../components/auction-products/auction-products';
import { defaultProps } from '../../components/auction-products/auction-products.props';
import type { SupportedLanguageCode } from '../../../../site/shared/languageCodes';
import { buildDesignCss, parseDesign } from './design';
import styles from './auction-products.module.css';

let nextDesignScopeId = 0;

class AuctionProductsWidgetElement extends HTMLElement {
  private root: Root | null = null;
  private container: HTMLDivElement | null = null;
  // Scopes this instance's design overrides when several widgets share a page.
  private readonly designScope = `auction-products-${++nextDesignScopeId}`;

  static get observedAttributes() {
    return [
      'header-title',
      'header-subtitle',
      'layout',
      'language',
      'auto-detect-language',
      'page-size',
      'auction-filter',
      'design',
    ];
  }

  connectedCallback() {
    this.setAttribute('data-design-scope', this.designScope);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = styles.root;
      this.appendChild(this.container);
    }
    if (!this.root) {
      this.root = createRoot(this.container);
    }
    this.render();
  }

  disconnectedCallback() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  attributeChangedCallback() {
    if (this.root) {
      this.render();
    }
  }

  private render() {
    if (!this.root) {
      return;
    }

    const headerTitle = this.hasAttribute('header-title')
      ? this.getAttribute('header-title') ?? defaultProps.headerTitle
      : defaultProps.headerTitle;

    const headerSubtitle = this.hasAttribute('header-subtitle')
      ? this.getAttribute('header-subtitle') ?? defaultProps.headerSubtitle
      : defaultProps.headerSubtitle;

    const layoutAttr = this.getAttribute('layout');
    const layout = layoutAttr === 'carousel' || layoutAttr === 'grid'
      ? layoutAttr
      : defaultProps.layout;

    const languageAttr = this.getAttribute('language');
    const language = (languageAttr as SupportedLanguageCode) || defaultProps.language;

    const autoDetectAttr = this.getAttribute('auto-detect-language');
    const autoDetectLanguage = autoDetectAttr !== null
      ? autoDetectAttr !== 'false'
      : defaultProps.autoDetectLanguage;

    const pageSizeAttr = this.getAttribute('page-size');
    const parsedPageSize = pageSizeAttr ? parseInt(pageSizeAttr, 10) : defaultProps.pageSize;
    const pageSize = !isNaN(parsedPageSize) && parsedPageSize >= 4 && parsedPageSize <= 60
      ? parsedPageSize
      : defaultProps.pageSize;

    const auctionFilterAttr = this.getAttribute('auction-filter');
    const auctionFilter =
      auctionFilterAttr === 'active' || auctionFilterAttr === 'all' || auctionFilterAttr === 'inactive'
        ? auctionFilterAttr
        : defaultProps.auctionFilter;

    const designCss = buildDesignCss(
      `[data-design-scope="${this.designScope}"]`,
      parseDesign(this.getAttribute('design')),
    );

    this.root.render(
      <>
        {designCss ? <style>{designCss}</style> : null}
        <AuctionProducts
          id={this.id || 'auction-products-site-widget'}
          headerTitle={headerTitle}
          headerSubtitle={headerSubtitle}
          layout={layout}
          language={language}
          autoDetectLanguage={autoDetectLanguage}
          pageSize={pageSize}
          auctionFilter={auctionFilter}
        />
      </>
    );
  }
}

export default AuctionProductsWidgetElement;
