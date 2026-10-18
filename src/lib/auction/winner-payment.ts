import type { AuctionRecord, WinnerPaymentDetails } from './types';

export function validateWinnerPaymentDetails(input?: WinnerPaymentDetails): WinnerPaymentDetails {
  const url = input?.url?.trim() ?? '';
  const buttonLabel = input?.buttonLabel?.trim() ?? '';
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Enter a valid HTTPS payment URL.');
  }

  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname || parsedUrl.username || parsedUrl.password) {
    throw new Error('Enter a valid HTTPS payment URL.');
  }

  if (!buttonLabel || buttonLabel.length > 80) {
    throw new Error('Enter a payment button label of 1 to 80 characters.');
  }

  return { url: parsedUrl.toString(), buttonLabel };
}

export function shouldStartNewPaymentEmailAttempt(
  auction: Pick<AuctionRecord, 'winnerPaymentEmailAttemptKey' | 'winnerPaymentEmailLastSentKey'>,
): boolean {
  return !auction.winnerPaymentEmailAttemptKey ||
    auction.winnerPaymentEmailAttemptKey === auction.winnerPaymentEmailLastSentKey;
}
