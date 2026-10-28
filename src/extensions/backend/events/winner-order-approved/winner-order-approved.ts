import { orders } from '@wix/ecom';
import { recordWinnerOrder } from '../../../../lib/server/auction-service';

// Links won auctions to the order placed from their winner checkout, which
// takes them out of the member's "won items" panel.
export default orders.onOrderApproved(async (event) => {
  try {
    const order = event.data?.order;
    if (order) {
      await recordWinnerOrder(order);
    }
  } catch (error) {
    console.error('[auction] order approved handler failed:', error);
  }
});
