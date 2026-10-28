import { orders } from '@wix/ecom';
import { recordWinnerOrder } from '../../../../lib/server/auction-service';

// Marks won auctions as paid once their winner checkout's order is paid.
export default orders.onOrderPaymentStatusUpdated(async (event) => {
  try {
    const order = event.data?.order;
    if (order) {
      await recordWinnerOrder(order, 'paymentStatus');
    }
  } catch (error) {
    console.error('[auction] order payment status handler failed:', error);
  }
});
