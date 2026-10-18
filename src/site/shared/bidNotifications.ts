import type { AuctionView } from '../../lib/auction/types';
import bidNotificationSoundUrl from '../../assets/smart-auction/bid-notification.wav';

export const BID_NOTIFICATION_POLL_INTERVAL_MS = 5000;
export const BID_NOTIFICATION_SOUND_PATH = bidNotificationSoundUrl;
const LOCAL_BID_SUPPRESSION_WINDOW_MS = 15000;
let bidNotificationAudioContext: AudioContext | null = null;
let isBidNotificationAudioUnlocked = false;
let bidNotificationAudioBuffer: AudioBuffer | null = null;
let bidNotificationAudioBufferPromise: Promise<AudioBuffer | null> | null = null;

type WindowWithWebkitAudioContext = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

export type AuctionBidSnapshot = {
  auctionId: string;
  currentHighestBidId: string | null;
  currentHighestBid: number | null;
  bidCount: number;
  endTime: string;
  status: AuctionView['status'];
};

export type LocalBidSuppression = AuctionBidSnapshot & {
  expiresAt: number;
};

export function createAuctionBidSnapshot(
  auction: AuctionView | null | undefined,
): AuctionBidSnapshot | null {
  if (!auction) {
    return null;
  }

  return {
    auctionId: auction.id,
    currentHighestBidId: auction.currentHighestBidId,
    currentHighestBid: auction.currentHighestBid,
    bidCount: auction.bidCount,
    endTime: auction.endTime,
    status: auction.status,
  };
}

export function createLocalBidSuppression(
  auction: AuctionView,
  expiresAt = Date.now() + LOCAL_BID_SUPPRESSION_WINDOW_MS,
): LocalBidSuppression {
  return {
    ...createAuctionBidSnapshot(auction)!,
    expiresAt,
  };
}

export function shouldNotifyOnRemoteBid(
  previous: AuctionBidSnapshot | null,
  next: AuctionBidSnapshot | null,
  suppression: LocalBidSuppression | null,
  now = Date.now(),
): boolean {
  if (!previous || !next) {
    return false;
  }

  if (previous.auctionId !== next.auctionId) {
    return false;
  }

  if (
    previous.currentHighestBidId === next.currentHighestBidId &&
    previous.currentHighestBid === next.currentHighestBid &&
    previous.bidCount === next.bidCount
  ) {
    return false;
  }

  const highestBidChanged =
    previous.currentHighestBidId !== next.currentHighestBidId &&
    next.currentHighestBidId !== null;
  const bidCountIncreased = next.bidCount > previous.bidCount;
  const bidAmountIncreased =
    (next.currentHighestBid ?? Number.NEGATIVE_INFINITY) >
    (previous.currentHighestBid ?? Number.NEGATIVE_INFINITY);

  if (!highestBidChanged || (!bidCountIncreased && !bidAmountIncreased)) {
    return false;
  }

  if (!suppression || suppression.expiresAt < now) {
    return true;
  }

  if (
    suppression.auctionId === next.auctionId &&
    suppression.currentHighestBidId &&
    suppression.currentHighestBidId === next.currentHighestBidId
  ) {
    return false;
  }

  return !(
    suppression.auctionId === next.auctionId &&
    suppression.currentHighestBid === next.currentHighestBid &&
    suppression.bidCount === next.bidCount
  );
}

export function createBidNotificationAudio(
  src = BID_NOTIFICATION_SOUND_PATH,
): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') {
    return null;
  }

  const audio = new Audio(src);
  audio.preload = 'auto';
  audio.volume = 0.7;
  audio.setAttribute('playsinline', 'true');
  audio.load();
  void preloadBidNotificationAudioBuffer(src);
  return audio;
}

function getBidNotificationAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (bidNotificationAudioContext) {
    return bidNotificationAudioContext;
  }

  const audioContextConstructor =
    window.AudioContext ||
    (window as WindowWithWebkitAudioContext).webkitAudioContext;

  if (!audioContextConstructor) {
    return null;
  }

  try {
    bidNotificationAudioContext = new audioContextConstructor();
  } catch {
    bidNotificationAudioContext = null;
  }

  return bidNotificationAudioContext;
}

async function playSynthBidNotification(): Promise<void> {
  const audioContext = getBidNotificationAudioContext();

  if (!audioContext || audioContext.state !== 'running') {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const startTime = audioContext.currentTime;

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(1320, startTime + 0.12);

  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.045, startTime + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.22);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + 0.24);
}

async function preloadBidNotificationAudioBuffer(
  src: string,
): Promise<AudioBuffer | null> {
  if (bidNotificationAudioBuffer) {
    return bidNotificationAudioBuffer;
  }

  if (bidNotificationAudioBufferPromise) {
    return bidNotificationAudioBufferPromise;
  }

  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return null;
  }

  bidNotificationAudioBufferPromise = (async () => {
    try {
      const audioContext = getBidNotificationAudioContext();

      if (!audioContext) {
        return null;
      }

      const response = await fetch(src, { cache: 'no-store' });

      if (!response.ok) {
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      bidNotificationAudioBuffer = decoded;
      return decoded;
    } catch {
      return null;
    } finally {
      bidNotificationAudioBufferPromise = null;
    }
  })();

  return bidNotificationAudioBufferPromise;
}

async function playBufferedBidNotification(
  src = BID_NOTIFICATION_SOUND_PATH,
): Promise<boolean> {
  const audioContext = getBidNotificationAudioContext();

  if (!audioContext || audioContext.state !== 'running') {
    return false;
  }

  const buffer =
    bidNotificationAudioBuffer ?? (await preloadBidNotificationAudioBuffer(src));

  if (!buffer) {
    return false;
  }

  const source = audioContext.createBufferSource();
  const gainNode = audioContext.createGain();

  source.buffer = buffer;
  gainNode.gain.setValueAtTime(0.9, audioContext.currentTime);

  source.connect(gainNode);
  gainNode.connect(audioContext.destination);
  source.start();

  return true;
}

export function attachBidNotificationUnlock(
  audio: HTMLAudioElement | null,
): (() => void) | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  let unlocked = false;

  const unlock = () => {
    if (unlocked) {
      return;
    }

    unlocked = true;
    isBidNotificationAudioUnlocked = true;

    const audioContext = getBidNotificationAudioContext();
    if (audioContext && audioContext.state !== 'running') {
      void audioContext.resume().catch(() => {
        // Ignore unlock failures and allow other playback paths to continue.
      });
    }

    if (audio?.currentSrc || audio?.src) {
      void preloadBidNotificationAudioBuffer(audio.currentSrc || audio.src);
    }

    if (!audio) {
      return;
    }

    audio.muted = true;
    const playAttempt = audio.play();

    if (playAttempt && typeof playAttempt.then === 'function') {
      void playAttempt
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        })
        .catch(() => {
          audio.muted = false;
        });
      return;
    }

    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
  };

  const eventNames: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];

  eventNames.forEach((eventName) => {
    window.addEventListener(eventName, unlock, { passive: true });
  });

  return () => {
    eventNames.forEach((eventName) => {
      window.removeEventListener(eventName, unlock);
    });
  };
}

export async function playBidNotification(
  audio: HTMLAudioElement | null,
): Promise<void> {
  if (audio) {
    try {
      audio.muted = false;
      audio.currentTime = 0;
      await audio.play();
      return;
    } catch {
      // Fall through to the synthesized notification sound below.
    }
  }

  if (!isBidNotificationAudioUnlocked) {
    return;
  }

  const playedBufferedAudio = await playBufferedBidNotification(
    audio?.currentSrc || audio?.src || BID_NOTIFICATION_SOUND_PATH,
  );

  if (playedBufferedAudio) {
    return;
  }

  await playSynthBidNotification();
}
