import React from 'react';
import type { ComponentProps, FC } from 'react';
import { withDefaults, withFallbackPlaceholder } from '@wix/react-component-utils';
import Component from './auction-products';
import { defaultProps } from './auction-products.props';
import { AuctionDataProvider } from './auction-data';
import { previewDataSource } from './preview-data';

// The editor stage shows sample auctions instead of calling the app's endpoints,
// polling for bids, or reading site/member APIs.
const AuctionProductsPreview: FC<ComponentProps<typeof Component>> = (props) => (
  <AuctionDataProvider value={previewDataSource}>
    <Component {...props} />
  </AuctionDataProvider>
);

const AuctionProductsPreviewWithFallback = withFallbackPlaceholder(AuctionProductsPreview, {
  requiredDataFields: ['headerTitle'],
  rootClassName: 'auction-products',
});

export default withDefaults(AuctionProductsPreviewWithFallback, defaultProps);
