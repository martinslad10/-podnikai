/**
 * Google Analytics 4 (GA4) Integration for PODNIKAI
 * Measurement ID: G-CKLVMBFKM0
 * 
 * Strict Privacy & Security Standards:
 * - NO customer PII (e-mails, personal names, phone numbers)
 * - NO questionnaire answers or sensitive inputs
 * - NO order security tokens (automatically redacted from URLs as well)
 * - Strictly server-confirmed purchase event triggering
 */

export const GA_MEASUREMENT_ID = 'G-CKLVMBFKM0';

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

/**
 * Sanitizes URLs to remove tokens, orderTokens, e-mails, or sensitive query params
 * before transmitting to Google Analytics.
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
  if (typeof window.gtag === 'function') {
    window.gtag(...args);
  } else {
    window.dataLayer.push(args);
  }
}

/**
 * Tracks generic event with sanitized properties
 */
export function trackEvent(eventName: string, params: Record<string, any> = {}): void {
  // Ensure no sensitive keys slip through
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
 */
export function trackPageView(pagePath?: string, pageTitle?: string): void {
  if (typeof window === 'undefined') return;
  const rawPath = pagePath || (window.location.pathname + window.location.search + window.location.hash);
  const path = sanitizeUrlForAnalytics(rawPath);
  const title = pageTitle || document.title;
  const location = sanitizeUrlForAnalytics(window.location.href);

  sendGtag('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: location
  });
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
    event_category: 'business_start',
    questions_count: 12
  });
}

/**
 * 4. checkout_start
 * Fired when the user proceeds to payment
 */
export function trackCheckoutStart(): void {
  sendGtag('event', 'checkout_start', {
    event_category: 'business_start',
    currency: 'CZK',
    value: 1990
  });
}

/**
 * 5. purchase
 * STRICT REQUIREMENT: Only fired on server-confirmed PAID status!
 * NEVER triggered solely on frontend button clicks.
 * Strictly no PII, answers, or tokens.
 */
export function trackPurchase(orderId: string, value: number = 1990, currency: string = 'CZK'): boolean {
  if (!orderId) return false;
  if (typeof window !== 'undefined') {
    const key = `podnikai_ga_purchased_${orderId}`;
    try {
      if (sessionStorage.getItem(key)) {
        return false; // Already tracked for this order in this session
      }
      sessionStorage.setItem(key, 'true');
    } catch {
      // Ignore storage restrictions
    }
  }

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
  return true;
}

/**
 * 6. report_ready
 * Fired when the Business Report is successfully generated and ready
 */
export function trackReportReady(orderId?: string): boolean {
  if (orderId && typeof window !== 'undefined') {
    const key = `podnikai_ga_report_ready_${orderId}`;
    try {
      if (sessionStorage.getItem(key)) {
        return false;
      }
      sessionStorage.setItem(key, 'true');
    } catch {
      // Ignore storage restrictions
    }
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
  if (typeof window !== 'undefined') {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && (k.startsWith('podnikai_ga_purchased_') || k.startsWith('podnikai_ga_report_ready_'))) {
          sessionStorage.removeItem(k);
        }
      }
    } catch {
      // Ignore
    }
  }
}
