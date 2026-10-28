import { extensions } from '@wix/astro/builders';

// Tools Aria (Wix's AI assistant) can call in the site dashboard. Each
// `methodName` routes to a handler in src/lib/server/aria-tools.ts via the
// `auction-tools-impl` Tools Provider service plugin.

const AUCTION_STATUS_ENUM = ['all', 'draft', 'scheduled', 'live', 'endingSoon', 'paused', 'closed', 'reserveNotMet', 'sold'];

const paging = {
  page: { type: 'number', description: '1-based page number. Defaults to 1.' },
  pageSize: { type: 'number', description: 'Results per page, up to 50. Defaults to 20.' },
};

const auctionSummarySchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'string', enum: AUCTION_STATUS_ENUM.slice(1) },
    lifecycle: { type: 'string' },
    productId: { type: ['string', 'null'] },
    startingPrice: { type: 'number' },
    reservePrice: { type: ['number', 'null'] },
    reserveReached: { type: 'boolean' },
    currentHighestBid: { type: ['number', 'null'] },
    minimumNextBid: { type: 'number' },
    bidCount: { type: 'number' },
    startTime: { type: 'string' },
    endTime: { type: ['string', 'null'] },
    winner: { type: ['object', 'null'] },
  },
};

const auctionFields = {
  title: { type: 'string', description: 'Auction title. Defaults to the product name when creating.' },
  description: { type: 'string', description: 'Auction description. Defaults to the product description when creating.' },
  startingPrice: { type: 'number', description: 'Opening bid amount in the site currency. Must be greater than 0.' },
  reservePrice: {
    type: ['number', 'null'],
    description: 'Lowest price the owner will accept. Must be at least the starting price. Use null for no reserve.',
  },
  minIncrement: { type: 'number', description: 'Minimum amount each new bid must add to the current highest bid.' },
  startTime: { type: 'string', description: 'ISO 8601 date-time when bidding opens, for example 2026-11-01T18:00:00Z.' },
  endTime: {
    type: 'string',
    description: 'ISO 8601 date-time when bidding closes. Must be after startTime. New auctions default to 7 days.',
  },
  antiSnipingEnabled: {
    type: 'boolean',
    description: 'Extend the auction when a bid arrives in its final moments (if the plan allows it).',
  },
};

export default extensions.appTools({
  id: '5bd71686-8db4-490c-9dcc-72dac187210b',
  name: 'auction-tools',
  tools: [
    {
      methodName: 'get-auction-overview',
      displayName: 'Get Auction Overview',
      description:
        'Returns a snapshot of the store\'s Smart Auction activity: total auctions, active auctions, auctions ending soon, total bids and total bidder leads, plus the next live auctions to end. Use this when the owner asks how their auctions are doing, for a summary or stats, or what is ending soon. Takes no input.',
      activated: true,
      requestSchema: { type: 'object', properties: {} },
      responseSchema: {
        type: 'object',
        properties: {
          currency: { type: ['string', 'null'] },
          planTier: { type: 'string' },
          summary: {
            type: 'object',
            properties: {
              totalAuctions: { type: 'number' },
              activeAuctions: { type: 'number' },
              endingSoon: { type: 'number' },
              totalBids: { type: 'number' },
              totalLeads: { type: 'number' },
            },
          },
          nextToEnd: { type: 'array', items: auctionSummarySchema },
        },
      },
    },
    {
      methodName: 'list-auctions',
      displayName: 'List Auctions',
      description:
        'Searches and lists the store\'s auctions with their status, current highest bid, bid count and timing. Use this when the owner asks to see, find or filter auctions, such as "show my live auctions", "which auctions are paused" or "find the Mustang auction". Also use it to look up an auctionId before acting on an auction.',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Text to match against auction title or product.' },
          status: { type: 'string', enum: AUCTION_STATUS_ENUM, description: 'Filter by displayed status. Defaults to all.' },
          activeOnly: { type: 'boolean', description: 'Only scheduled, live, ending-soon and paused auctions.' },
          ...paging,
        },
      },
      responseSchema: {
        type: 'object',
        properties: { total: { type: 'number' }, auctions: { type: 'array', items: auctionSummarySchema } },
      },
    },
    {
      methodName: 'get-auction-bids',
      displayName: 'Get Auction Bids',
      description:
        'Lists the bids placed on one auction, highest first, with bidder name, email, amount and time. Use this when the owner asks who is bidding, who the top bidder is, or to see the bid history of an auction. Requires an auctionId; use list-auctions first if you only know the auction name.',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          auctionId: { type: 'string', description: 'ID of the auction.' },
          search: { type: 'string', description: 'Filter bids by bidder name or email.' },
          winner: { type: 'string', enum: ['all', 'winner', 'others'], description: 'Only the winning bid, or only the others.' },
          ...paging,
        },
        required: ['auctionId'],
      },
      responseSchema: {
        type: 'object',
        properties: {
          total: { type: 'number' },
          bids: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                bidderName: { type: 'string' },
                bidderEmail: { type: 'string' },
                amount: { type: 'number' },
                createdAt: { type: 'string' },
                isMember: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    {
      methodName: 'search-store-products',
      displayName: 'Search Store Products',
      description:
        'Searches the Wix Stores catalog and shows whether each product is already linked to an auction. Use this to find a productId before creating an auction, or when the owner asks which products are or are not on auction. A product can only have one unfinished auction at a time.',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Product name or SKU to search for.' },
          auctionLink: {
            type: 'string',
            enum: ['all', 'linked', 'unlinked'],
            description: 'Only products with (linked) or without (unlinked) an auction.',
          },
          ...paging,
        },
      },
      responseSchema: {
        type: 'object',
        properties: {
          total: { type: 'number' },
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                sku: { type: 'string' },
                auctions: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
    },
    {
      methodName: 'create-auction',
      displayName: 'Create Auction',
      description:
        'Creates a new auction for one Wix Stores product. Use this when the owner asks to auction a product, put an item up for bidding, or start an auction. Requires productId (find it with search-store-products) and startingPrice. It is saved as a draft unless publish is true, and the plan\'s active-auction limit applies to published auctions.',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'ID of the Wix Stores product to auction.' },
          ...auctionFields,
          publish: { type: 'boolean', description: 'Publish immediately instead of saving as a draft. Defaults to false.' },
        },
        required: ['productId', 'startingPrice'],
      },
      responseSchema: { type: 'object', properties: { auction: auctionSummarySchema } },
    },
    {
      methodName: 'update-auction',
      displayName: 'Update Auction',
      description:
        'Changes an existing auction\'s title, description, starting price, reserve price, bid increment, start or end time, or anti-sniping setting. Use this when the owner asks to edit an auction, extend or shorten it, or change its prices. Requires auctionId and only the fields to change. To publish, pause or close an auction use run-auction-action instead.',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: { auctionId: { type: 'string', description: 'ID of the auction to change.' }, ...auctionFields },
        required: ['auctionId'],
      },
      responseSchema: { type: 'object', properties: { auction: auctionSummarySchema } },
    },
    {
      methodName: 'run-auction-action',
      displayName: 'Run Auction Action',
      description:
        'Changes an auction\'s lifecycle: publish it (make it visible and open for bidding), move it back to draft, pause bidding, resume a paused auction, or close it early. Use this when the owner asks to publish, unpublish, pause, resume, stop or end an auction. Requires auctionId and action. Winner selection and deletion are not available here; the owner does those in the dashboard.',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          auctionId: { type: 'string', description: 'ID of the auction.' },
          action: { type: 'string', enum: ['publish', 'draft', 'pause', 'resume', 'close'] },
        },
        required: ['auctionId', 'action'],
      },
      responseSchema: { type: 'object', properties: { auction: auctionSummarySchema } },
    },
    {
      methodName: 'search-leads',
      displayName: 'Search Bidder Leads',
      description:
        'Lists bidder leads (people who placed bids) with name, email, phone, bid amount and the auction they bid on. Use this when the owner asks for bidder contacts, a list of leads, or who bid on a specific auction. Optionally filter by text or by auctionId.',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Filter by bidder name, email or phone.' },
          auctionId: { type: 'string', description: 'Only leads from this auction.' },
          ...paging,
        },
      },
      responseSchema: {
        type: 'object',
        properties: { total: { type: 'number' }, leads: { type: 'array', items: { type: 'object' } } },
      },
    },
    {
      methodName: 'get-settings',
      displayName: 'Get Auction Settings',
      description:
        'Returns the Smart Auction app settings: business name, plan tier, default bid increment, anti-sniping window and extension, email bidding, outbid and winner emails, bidder confirmation, and cart/checkout blocking. Use this when the owner asks how the auction app is configured or before changing a setting. Takes no input.',
      activated: true,
      requestSchema: { type: 'object', properties: {} },
      responseSchema: { type: 'object', properties: { settings: { type: 'object' } } },
    },
    {
      methodName: 'update-settings',
      displayName: 'Update Auction Settings',
      description:
        'Changes one or more Smart Auction app settings and keeps every other setting as it is. Use this when the owner asks to turn email bidding, outbid notifications, winner checkout emails, bidder confirmation or anti-sniping on or off, or to change the default bid increment, anti-sniping timing, business name or WhatsApp phone. The plan tier cannot be changed here.',
      activated: true,
      requestSchema: {
        type: 'object',
        properties: {
          businessName: { type: 'string' },
          defaultMinIncrement: { type: 'number', description: 'Default minimum bid increment for new auctions.' },
          antiSnipingEnabled: { type: 'boolean' },
          antiSnipingWindowSeconds: { type: 'number', description: 'Seconds before the end in which a bid triggers an extension.' },
          antiSnipingExtensionSeconds: { type: 'number', description: 'Seconds added when anti-sniping triggers.' },
          emailBiddingEnabled: { type: 'boolean', description: 'Let visitors bid with an email address instead of signing in.' },
          emailWinnerPaymentLinkEnabled: { type: 'boolean' },
          outbidNotificationEnabled: { type: 'boolean' },
          winnerCheckoutEmailEnabled: { type: 'boolean' },
          bidderConfirmationEnabled: { type: 'boolean' },
          whatsappPhone: { type: 'string' },
          myBidsPageUrl: { type: 'string' },
          blockCartAndCheckout: { type: 'boolean', description: 'Block buying auctioned products through the cart.' },
          blockAllCartAndCheckout: { type: 'boolean' },
          combinedWinnerCheckoutEnabled: { type: 'boolean', description: 'Let signed-in members pay for all their won items in one checkout.' },
        },
      },
      responseSchema: {
        type: 'object',
        properties: { updated: { type: 'array', items: { type: 'string' } }, settings: { type: 'object' } },
      },
    },
  ],
});
