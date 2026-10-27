import { extensions } from '@wix/astro/builders'

export default extensions.customElement({
  id: '9de705fe-34c0-46c8-808f-29f515645238',
  name: 'Auction Products',
  width: {
    defaultWidth: 980,
    allowStretch: true,
  },
  height: {
    defaultHeight: 600,
  },
  installation: {
    autoAdd: true,
  },
  presets: [
    {
      id: 'abddf3ba-ee04-45fd-95c4-b7daadded36c',
      name: 'default',
      thumbnailUrl: '{{BASE_URL}}/auction-products-thumbnail.png',
    },
  ],
  
  tagName: 'auction-products',
  element: './extensions/site/widgets/auction-products/auction-products.tsx',
  settings: './extensions/site/widgets/auction-products/auction-products.panel.tsx',
});
