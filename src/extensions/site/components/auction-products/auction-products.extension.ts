import { extensions } from '@wix/astro/builders'
import { LAYOUT } from '@wix/react-component-schema';
import { withEditorElementDefaults } from '@wix/react-component-utils';
import merge from 'deepmerge';
import { editorElement } from './auction-products.generated';
import { defaultProps } from './auction-products.props';
import { SUPPORTED_LANGUAGE_OPTIONS } from '../../../../site/shared/languageCodes';
import componentUrl from './component.tsx?url';
import componentPreviewUrl from './component.preview.tsx?url';

const editorElementWithDefaults = withEditorElementDefaults(
  editorElement,
  defaultProps
);

export default extensions.editorReactComponent({
  id: '343387e9-42c4-4d5f-b747-008cc27facb5',
  type: 'HiKonsultsSmartAuctionManager.AuctionProducts',
  displayName: 'Auction Products',
  description: 'A grid of store products on auction with live status, countdown, current bid, search and filters, and a bid form so visitors can place bids.',
  editorElement: merge(
    editorElementWithDefaults,
    {
      layout: {
        resizeDirection: LAYOUT.RESIZE_DIRECTION.horizontal,
        contentResizeDirection: LAYOUT.CONTENT_RESIZE_DIRECTION.vertical,
      },
      // Show language names instead of the generated "En", "Es", ... labels.
      data: {
        language: {
          textEnum: {
            options: SUPPORTED_LANGUAGE_OPTIONS.map(({ id, value }) => ({ value: id, displayName: value })),
          },
        },
      },
    },
    { arrayMerge: (_target, source) => source }
  ),
  installation: {
    initialSize: {
      width: {
        sizingType: LAYOUT.SIZING_TYPE.pixels,
        pixels: 980,
      },
      height: {
        sizingType: LAYOUT.SIZING_TYPE.content,
      },
    },
  },
  resources: {
    client: {
      componentUrl,
    },
    editor: {
      componentUrl: componentPreviewUrl,
    },
  },
});
