/**
 * Analytics and Privacy Tracking Module for PODNIKAI
 * 
 * Supports:
 * - Google Analytics 4 (GA4): G-CKLVMBFKM0 (Google Consent Mode v2)
 * - Meta Pixel: 1598776808008151 (Strict consent enforcement & secure server purchase verification)
 * 
 * Strict Privacy & Security Standards:
 * - NO customer PII (e-mails, personal names, phone numbers)
 * - NO questionnaire answers or sensitive inputs
 * - NO order security tokens (automatically redacted from URLs as well)
 * - Meta Pixel only receives events after explicit cookie consent ('all')
 * - Strictly server-confirmed purchase event triggering (paymentStatus === 'PAID')
 * - Deduplicated purchases by unique Order ID
 */

export const GA_MEASUREMENT_ID = 'G-CKLVMBFKM0';
export const META_PIXEL_ID = '1598776808008151';

export type CookieConsentState = 'all' | 'necessary';

const CONSENT_STORAGE_KEY = 'podnikai_cookie_consent';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

/**
 * Retrieves the current cookie consent choice from localStorage.
 * Returns null if the user hasn't made a choice yet.
 */
export function getCookieConsent(): CookieConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const val = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (val === 'all' || val === 'necessary') return val;
    return null;
  } catch {
    return null;
  }
}

/**
 * Updates the cookie consent choice and dispatches consent signals to GA4 and Meta Pixel.
 */
export function setCookieConsent(state: CookieConsentState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, state);
  } catch {
    // Ignore localStorage errors
  }

  applyConsentState(state);

  // Dispatch custom event so UI components (like the footer / banner) can react immediately
  window.dispatchEvent(new CustomEvent('podnikai-consent-change', { detail: state }));
}

/**
 * Resets cookie consent (for re-opening the banner / settings).
 */
export function resetCookieConsent(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // Ignore
  }
  applyConsentState('necessary');
  window.dispatchEvent(new CustomEvent('podnikai-consent-change', { detail: null }));
}

/**
 * Internal helper to configure GA4 and Meta Pixel consent states.
 */
export function applyConsentState(state: CookieConsentState | null): void {
  if (typeof window === 'undefined') return;

  if (state === 'all') {
    // Update GA4 consent to granted
    sendGtag('consent', 'update', {
      'analytics_storage': 'granted',
      'ad_storage': 'granted',
      'ad_user_data': 'granted',
      'ad_personalization': 'granted'
    });

    // Grant Meta Pixel consent and track current page
    sendFbq('consent', 'grant');
    ensureMetaPixelInitialized();
  } else {
    // Only necessary or no consent yet:
    // Revoke advertising / marketing storage
    sendGtag('consent', 'update', {
      'analytics_storage': state === 'necessary' ? 'granted' : 'denied',
      'ad_storage': 'denied',
      'ad_user_data': 'denied',
      'ad_personalization': 'denied'
    });

    // Revoke Meta Pixel consent
    sendFbq('consent', 'revoke');
  }
}

/**
 * Safe invocation of Meta Pixel fbq.
 */
export function sendFbq(...args: any[]): void {
  if (typeof window === 'undefined') return;
  if (typeof window.fbq === 'function') {
    window.fbq(...args);
  }
}

let metaPixelInitialized = false;

/**
 * Ensures Meta Pixel is initialized with ID once consent is granted.
 */
export function ensureMetaPixelInitialized(): void {
  if (typeof window === 'undefined') return;
  if (metaPixelInitialized) return;

  const consent = getCookieConsent();
  if (consent !== 'all') return;

  if (typeof window.fbq === 'function') {
    window.fbq('init', META_PIXEL_ID);
    metaPixelInitialized = true;
    window.fbq('track', 'PageView');
  }
}

/**
 * Sanitizes URLs to remove tokens, orderTokens, e-mails, or sensitive query params
 * before transmitting to Analytics or Meta Pixel.
 */
export function sanitizeUrlForAnalytics(rawUrl: string): string {
  if (!rawUrl) return '';
  return rawUrl
    .replace(/([?&#](?:orderToken|token|secret|key|email)=)[^&#]*/gi, '$1[REDACTED]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');
}

/**
 * Safe invocation of gtag that works even if script hasn't loaded yet
 * or in SSR / test environments.
 */
export function sendGtag(...args: any[]): void {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function() {
      (window.dataLayer = window.dataLayer || []).push(arguments);
    };
  }
  window.gtag(...args);
}

/**
 * Tracks generic event with sanitized properties
 */
export function trackEvent(eventName: string, params: Record<string, any> = {}): void {
  const safeParams: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (['email', 'orderToken', 'token', 'clientName', 'phone', 'answers'].includes(k)) {
      continue;
    }
    safeParams[k] = v;
  }
  sendGtag('event', eventName, safeParams);
}

/**
 * 1. Standard Page View (with URL sanitization to prevent token leaks)
 * Dispatches to GA4 always and to Meta Pixel if consent is granted.
 */
export function trackPageView(pagePath?: string, pageTitle?: string): void {
  if (typeof window === 'undefined') return;
  const rawPath = pagePath || (window.location.pathname + window.location.search + window.location.hash);
  const path = sanitizeUrlForAnalytics(rawPath);
  const title = pageTitle || document.title;
  const location = sanitizeUrlForAnalytics(window.location.href);

  // GA4 page_view
  sendGtag('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: location
  });

  // Meta Pixel PageView (ONLY if marketing consent is granted)
  if (getCookieConsent() === 'all') {
    ensureMetaPixelInitialized();
    sendFbq('track', 'PageView');
  }
}

/**
 * 2. questionnaire_start
 * Fired when the user starts filling the 12 questions
 */
let questionnaireStartTracked = false;

export function trackQuestionnaireStart(): void {
  if (questionnaireStartTracked) return;
  questionnaireStartTracked = true;
  sendGtag('event', 'questionnaire_start', {
    event_category: 'business_start'
  });
}

export function resetQuestionnaireStartState(): void {
  questionnaireStartTracked = false;
}

/**
 * 3. questionnaire_complete
 * Fired when the user completes all 12 questions and submits them to order preview/summary
 */
export function trackQuestionnaireComplete(): void {
  sendGtag('event', 'questionnaire_complete', {
    event_category: 'business_start'
  });
}

/**
 * Offer view tracking
 */
export function trackOfferView(orderId?: string, value: number = 690): void {
  sendGtag('event', 'offer_view', {
    event_category: 'business_start',
    currency: 'CZK',
    value: value,
    ...(orderId ? { order_id: orderId } : {})
  });
}

/**
 * 4. checkout_start
 * Fired when the user proceeds to payment
 */
export function trackCheckoutStart(value: number = 690): void {
  sendGtag('event', 'checkout_start', {
    event_category: 'business_start',
    currency: 'CZK',
    value: value
  });

  if (getCookieConsent() === 'all') {
    sendFbq('track', 'InitiateCheckout', {
      value: value,
      currency: 'CZK',
      content_name: 'PODNIKAI Business Start'
    });
  }
}

/**
 * 5. purchase
 * STRICT REQUIREMENT: Only fired on server-confirmed PAID status!
 * NEVER triggered solely on frontend button clicks.
 * Strictly no PII, answers, or tokens.
 * Deduplicated per unique orderId across sessions and browser restarts using persistent localStorage.
 * Meta Pixel Purchase is fired ONLY if user granted cookie consent ('all').
 */
const inMemoryPurchasedOrders = new Set<string>();

export function isPurchaseTracked(orderId: string): boolean {
  if (!orderId) return false;
  if (inMemoryPurchasedOrders.has(orderId)) return true;
  if (typeof window !== 'undefined') {
    const key = `podnikai_purchased_${orderId}`;
    const legacyKey = `podnikai_ga_purchased_${orderId}`;
    try {
      return !!(
        localStorage.getItem(key) ||
        localStorage.getItem(legacyKey) ||
        sessionStorage.getItem(key) ||
        sessionStorage.getItem(legacyKey)
      );
    } catch {
      return false;
    }
  }
  return false;
}

export function trackPurchase(orderId: string, value: number = 690, currency: string = 'CZK'): boolean {
  if (!orderId) return false;

  // 1. In-memory check: prevents duplicates in current JS execution
  if (inMemoryPurchasedOrders.has(orderId)) {
    return false;
  }

  // 2. Persistent storage check: survives browser close, new tabs, sessions, and link revisits
  if (typeof window !== 'undefined') {
    const key = `podnikai_purchased_${orderId}`;
    const legacyKey = `podnikai_ga_purchased_${orderId}`;
    try {
      const alreadyInLocalStorage = localStorage.getItem(key) || localStorage.getItem(legacyKey);
      const alreadyInSessionStorage = sessionStorage.getItem(key) || sessionStorage.getItem(legacyKey);

      if (alreadyInLocalStorage || alreadyInSessionStorage) {
        inMemoryPurchasedOrders.add(orderId);
        return false; // Already tracked for this order previously
      }

      // Record in both persistent localStorage and sessionStorage
      localStorage.setItem(key, 'true');
      sessionStorage.setItem(key, 'true');
    } catch {
      // In restricted private browsing environments, inMemoryPurchasedOrders provides safety
    }
  }

  inMemoryPurchasedOrders.add(orderId);

  // GA4 purchase
  sendGtag('event', 'purchase', {
    transaction_id: orderId,
    value: value,
    currency: currency,
    items: [
      {
        item_id: 'podnikai_business_start',
        item_name: 'PODNIKAI Business Start',
        price: value,
        quantity: 1
      }
    ]
  });

  // Meta Pixel Purchase (ONLY if consent is granted)
  if (getCookieConsent() === 'all') {
    sendFbq('track', 'Purchase', {
      value: value,
      currency: currency,
      content_name: 'PODNIKAI Business Start',
      content_type: 'product',
      order_id: orderId
    });
  }

  return true;
}

/**
 * 6. report_ready
 * Fired when the Business Report is successfully generated and ready
 */
const inMemoryReportReadyOrders = new Set<string>();

export function trackReportReady(orderId?: string): boolean {
  if (orderId) {
    if (inMemoryReportReadyOrders.has(orderId)) {
      return false;
    }
    if (typeof window !== 'undefined') {
      const key = `podnikai_report_ready_${orderId}`;
      const legacyKey = `podnikai_ga_report_ready_${orderId}`;
      try {
        if (
          localStorage.getItem(key) ||
          localStorage.getItem(legacyKey) ||
          sessionStorage.getItem(key) ||
          sessionStorage.getItem(legacyKey)
        ) {
          inMemoryReportReadyOrders.add(orderId);
          return false;
        }
        localStorage.setItem(key, 'true');
        sessionStorage.setItem(key, 'true');
      } catch {
        // Ignore storage restrictions
      }
    }
    inMemoryReportReadyOrders.add(orderId);
  }

  sendGtag('event', 'report_ready', {
    event_category: 'business_start',
    ...(orderId ? { order_id: orderId } : {})
  });
  return true;
}

/**
 * 7. pdf_download
 * Fired when the customer downloads the PDF report
 */
export function trackPdfDownload(orderId?: string): void {
  sendGtag('event', 'pdf_download', {
    event_category: 'business_start',
    file_name: 'PODNIKAI_Report.pdf',
    ...(orderId ? { order_id: orderId } : {})
  });
}

/**
 * Reset tracking state for unit tests
 */
export function resetAnalyticsStateForTests(): void {
  questionnaireStartTracked = false;
  metaPixelInitialized = false;
  inMemoryPurchasedOrders.clear();
  inMemoryReportReadyOrders.clear();
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(CONSENT_STORAGE_KEY);
      if (typeof localStorage.key === 'function') {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('podnikai_purchased_') || k.startsWith('podnikai_ga_purchased_') || k.startsWith('podnikai_report_ready_') || k.startsWith('podnikai_ga_report_ready_'))) {
            localStorage.removeItem(k);
          }
        }
      }
      if (typeof sessionStorage.key === 'function') {
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && (k.startsWith('podnikai_purchased_') || k.startsWith('podnikai_ga_purchased_') || k.startsWith('podnikai_report_ready_') || k.startsWith('podnikai_ga_report_ready_'))) {
            sessionStorage.removeItem(k);
          }
        }
      }
    } catch {
      // Ignore
    }
  }
}
