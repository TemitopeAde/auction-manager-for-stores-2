import { app } from '@wix/astro/builders';
import myPage from './extensions/dashboard/pages/my-page/my-page.extension.ts';

import auctionProducts from './extensions/site/components/auction-products/auction-products.extension.ts';

import auctionTools from './extensions/backend/app-tools/auction-tools/auction-tools.extension.ts';

import auctionToolsImpl from './extensions/backend/service-plugins/auction-tools-impl/auction-tools-impl.extension.ts';

import auctionProductsWidget from './extensions/site/widgets/auction-products/auction-products.extension.ts';

export default app()
  .use(myPage)
  .use(auctionProducts)
  .use(auctionTools)
  .use(auctionToolsImpl)
  .use(auctionProductsWidget);
