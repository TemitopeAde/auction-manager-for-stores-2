import { emailTransmissions } from '@wix/email-transmissions';
import { auth } from '@wix/essentials';

const MAX_RECIPIENTS_PER_TRANSMISSION = 100;
const MAX_SENDER_NAME_LENGTH = 50;

export type AuctionEmailRecipient = {
  email: string;
  name?: string;
};

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function isValidIdempotencyKey(value: string | null | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim()));
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isBlankHtml(html: string): boolean {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length === 0;
}

function wrapEmailHtml(input: {
  brandName: string;
  previewText: string;
  eyebrow: string;
  title: string;
  introHtml: string;
  details?: Array<{ label: string; value: string }>;
  cta?: { href: string; label: string };
  secondaryLink?: { href: string; label: string };
  closingHtml?: string;
}): string {
  const brandName = escapeHtml(input.brandName.trim() || 'Auction Manager for Stores');
  const detailsRows = (input.details ?? [])
    .map(
      (detail, index) => `
        <tr>
          <td style="padding:${index === 0 ? '0' : '14px'} 0 0;border-top:${
            index === 0 ? '0' : '1px solid #e8edf3'
          };">
            <p style="margin:${index === 0 ? '0' : '14px'} 0 0;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">
              ${escapeHtml(detail.label)}
            </p>
            <p style="margin:4px 0 0;font-size:16px;line-height:1.4;color:#0f172a;font-weight:600;">
              ${escapeHtml(detail.value)}
            </p>
          </td>
        </tr>`,
    )
    .join('');

  const detailsBlock = detailsRows
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">${detailsRows}</table>`
    : '';

  const ctaBlock = input.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 8px;">
        <tr>
          <td style="border-radius:10px;background:#0f172a;">
            <a href="${escapeHtml(input.cta.href)}" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
              ${escapeHtml(input.cta.label)}
            </a>
          </td>
        </tr>
      </table>`
    : '';

  const secondaryLink = input.secondaryLink
    ? `<p style="margin:16px 0 0;font-size:14px;">
        <a href="${escapeHtml(input.secondaryLink.href)}" style="color:#2563eb;text-decoration:none;font-weight:600;">
          ${escapeHtml(input.secondaryLink.label)} →
        </a>
      </p>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f5f8;font-family:'Helvetica Neue',Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.previewText)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
            <tr>
              <td style="padding:0 8px 20px;">
                <p style="margin:0;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;color:#64748b;font-weight:700;">
                  ${brandName}
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #e8edf3;border-radius:16px;padding:32px 28px;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;font-weight:600;">
                  ${escapeHtml(input.eyebrow)}
                </p>
                <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;font-weight:700;color:#0f172a;">
                  ${escapeHtml(input.title)}
                </h1>
                <div style="font-size:15px;line-height:1.7;color:#334155;">
                  ${input.introHtml}
                </div>
                ${detailsBlock}
                ${ctaBlock}
                ${secondaryLink}
                ${
                  input.closingHtml
                    ? `<div style="margin-top:28px;font-size:14px;line-height:1.7;color:#475569;">${input.closingHtml}</div>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="padding:20px 8px 0;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                  This is a transactional message from ${brandName}. If you were not expecting this email, you can ignore it.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function htmlParagraph(text: string): string {
  return `<p style="margin:0 0 16px;">${text}</p>`;
}

export function buildOwnerBidNotificationEmail(input: {
  businessName: string;
  auctionTitle: string;
  bidAmount: string;
  bidderName: string;
  bidderEmail: string;
  bidderPhone: string;
}): { subject: string; html: string } {
  const brandName = input.businessName.trim() || 'Auction Manager for Stores';
  const subject = `New bid received · ${input.auctionTitle}`;
  const html = wrapEmailHtml({
    brandName,
    previewText: `${input.bidderName} bid ${input.bidAmount} on ${input.auctionTitle}.`,
    eyebrow: 'Bid activity',
    title: 'A new bid has been placed',
    introHtml: htmlParagraph(
      `A bidder submitted a new offer on <strong>${escapeHtml(input.auctionTitle)}</strong>. Review the details below.`,
    ),
    details: [
      { label: 'Auction', value: input.auctionTitle },
      { label: 'Bid amount', value: input.bidAmount },
      { label: 'Bidder', value: input.bidderName },
      { label: 'Email', value: input.bidderEmail },
      { label: 'Phone', value: input.bidderPhone || 'Not provided' },
    ],
    closingHtml: htmlParagraph(
      'You are receiving this because owner bid notifications are enabled for your auction settings.',
    ),
  });

  return { subject, html };
}

export function buildBidderConfirmationEmail(input: {
  businessName?: string;
  auctionTitle: string;
  bidAmount: string;
  bidderName: string;
}): { subject: string; html: string } {
  const brandName = input.businessName?.trim() || 'Auction Manager for Stores';
  const firstName = input.bidderName.trim().split(/\s+/)[0] || 'there';
  const subject = `Your bid is confirmed · ${input.auctionTitle}`;
  const html = wrapEmailHtml({
    brandName,
    previewText: `Your bid of ${input.bidAmount} on ${input.auctionTitle} has been recorded.`,
    eyebrow: 'Bid confirmation',
    title: 'Your bid is in',
    introHtml: htmlParagraph(
      `Hi ${escapeHtml(firstName)}, thank you. We have recorded your bid of <strong>${escapeHtml(input.bidAmount)}</strong> on <strong>${escapeHtml(input.auctionTitle)}</strong>.`,
    ),
    details: [
      { label: 'Auction', value: input.auctionTitle },
      { label: 'Your bid', value: input.bidAmount },
    ],
    closingHtml: `${htmlParagraph(
      'We will email you if another bidder takes the lead, or if you win when the auction closes.',
    )}<p style="margin:0;">Good luck.</p>`,
  });

  return { subject, html };
}

export function buildOutbidNotificationEmail(input: {
  businessName?: string;
  auctionTitle: string;
  productName: string;
  previousBidAmount: string;
  currentHighestBid: string;
  auctionEndDate: string;
  placeNewBidUrl: string;
  myBidsDashboardUrl: string;
}): { subject: string; html: string } {
  const brandName = input.businessName?.trim() || 'Auction Manager for Stores';
  const listingName = input.productName || input.auctionTitle;
  const subject = `You have been outbid · ${input.auctionTitle}`;
  const html = wrapEmailHtml({
    brandName,
    previewText: `The current lead on ${listingName} is now ${input.currentHighestBid}.`,
    eyebrow: 'Auction update',
    title: 'Another bid is now in the lead',
    introHtml: htmlParagraph(
      `A higher bid was placed on <strong>${escapeHtml(listingName)}</strong>. You can still take the lead before the auction ends.`,
    ),
    details: [
      { label: 'Your last bid', value: input.previousBidAmount },
      { label: 'Current highest bid', value: input.currentHighestBid },
      { label: 'Auction ends', value: input.auctionEndDate },
    ],
    cta: input.placeNewBidUrl
      ? { href: input.placeNewBidUrl, label: 'Place a higher bid' }
      : undefined,
    secondaryLink: input.myBidsDashboardUrl
      ? { href: input.myBidsDashboardUrl, label: 'View my bids' }
      : undefined,
    closingHtml: htmlParagraph(
      'Bidding stays open until the scheduled end time. A new bid near the close may extend the auction.',
    ),
  });

  return { subject, html };
}

export function buildWinnerCheckoutEmail(input: {
  businessName?: string;
  auctionTitle: string;
  bidderName: string;
  checkoutUrl: string;
}): { subject: string; html: string } {
  const brandName = input.businessName?.trim() || 'Auction Manager for Stores';
  const firstName = input.bidderName.trim().split(/\s+/)[0] || 'there';
  const subject = `You won · ${input.auctionTitle}`;
  const html = wrapEmailHtml({
    brandName,
    previewText: `Complete checkout to claim ${input.auctionTitle}.`,
    eyebrow: 'Auction result',
    title: 'Congratulations, you won',
    introHtml: htmlParagraph(
      `Hi ${escapeHtml(firstName)}, you are the winning bidder for <strong>${escapeHtml(input.auctionTitle)}</strong>. Complete checkout to secure the item.`,
    ),
    details: [{ label: 'Auction', value: input.auctionTitle }],
    cta: { href: input.checkoutUrl, label: 'Complete checkout' },
    closingHtml: htmlParagraph(
      'If checkout is not completed, the seller may contact the next eligible bidder.',
    ),
  });

  return { subject, html };
}

export function buildWinnerPaymentLinkEmail(input: {
  businessName?: string;
  auctionTitle: string;
  bidderName: string;
  paymentUrl: string;
  buttonLabel: string;
}): { subject: string; html: string } {
  const brandName = input.businessName?.trim() || 'Auction Manager for Stores';
  const firstName = input.bidderName.trim().split(/\s+/)[0] || 'there';
  return {
    subject: `You won · ${input.auctionTitle}`,
    html: wrapEmailHtml({
      brandName,
      previewText: `Complete payment to claim ${input.auctionTitle}.`,
      eyebrow: 'Auction result',
      title: 'Congratulations, you won',
      introHtml: htmlParagraph(
        `Hi ${escapeHtml(firstName)}, you are the winning bidder for <strong>${escapeHtml(input.auctionTitle)}</strong>. Use the payment link below to secure the item.`,
      ),
      details: [{ label: 'Auction', value: input.auctionTitle }],
      cta: { href: input.paymentUrl, label: input.buttonLabel },
      closingHtml: htmlParagraph('If you have already paid, no further action is needed.'),
    }),
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function sendAuctionEmail(input: {
  senderName: string;
  recipients: AuctionEmailRecipient[];
  subject: string;
  html: string;
  idempotencyKey?: string;
}): Promise<number> {
  const uniqueRecipients = Array.from(
    new Map(
      input.recipients
        .map((recipient) => ({
          email: recipient.email.trim().toLowerCase(),
          name: recipient.name?.trim() || undefined,
        }))
        .filter((recipient) => recipient.email.length > 0)
        .map((recipient) => [recipient.email, recipient]),
    ).values(),
  );

  if (uniqueRecipients.length === 0) {
    throw new Error('At least one recipient email is required.');
  }

  const senderName = input.senderName.trim().slice(0, MAX_SENDER_NAME_LENGTH) || 'Auction Manager for Stores';
  const send = auth.elevate(emailTransmissions.sendEmailTransmission);
  const groups = chunk(uniqueRecipients, MAX_RECIPIENTS_PER_TRANSMISSION);

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    await send(
      {
        emailSubject: input.subject,
        emailHtmlContent: input.html,
        senderName,
        toRecipients: group.map((recipient) => ({
          emailAddress: recipient.email,
          name: recipient.name?.slice(0, 50) || undefined,
        })),
        type: 'TRANSACTIONAL',
      },
      {
        idempotencyKey:
          groups.length === 1
            ? input.idempotencyKey ?? createIdempotencyKey()
            : createIdempotencyKey(),
      },
    );
  }

  return uniqueRecipients.length;
}
