import { auth } from '@wix/essentials';
import { members } from '@wix/members';

export type CallerMember = {
  id: string;
  email: string;
  name: string;
  phone: string;
};

/**
 * The site member making this request, resolved from the caller's own token
 * (sent by `httpClient.fetchWithAuth`). Returns null for visitors. Never read
 * member IDs or emails from a request body to identify the caller.
 */
export async function getCallerMember(): Promise<CallerMember | null> {
  try {
    const { member } = await members.getCurrentMember({ fieldsets: ['FULL'] });
    if (!member?._id) {
      return null;
    }
    const contact = member.contact;
    return {
      id: member._id,
      email: member.loginEmail ?? contact?.emails?.[0] ?? '',
      name:
        [contact?.firstName, contact?.lastName].filter(Boolean).join(' ').trim() ||
        member.profile?.nickname ||
        '',
      phone: contact?.phones?.[0] ?? '',
    };
  } catch {
    return null;
  }
}

/** True when the caller is a Wix user (site owner or collaborator). */
export async function isCallerWixUser(): Promise<boolean> {
  const tokenInfo = await auth.getTokenInfo().catch(() => null);
  return Boolean(tokenInfo?.active && tokenInfo.subjectType === 'USER');
}
