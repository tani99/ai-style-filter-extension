import { SUPPORTED_SITES } from '../config/SiteConfigurations.js';

/**
 * SiteDetector handles detection of supported e-commerce sites
 * and provides site-specific configuration information.
 */
export class SiteDetector {
    constructor(hostname) {
        this.currentHost = hostname || '';
    }

    /**
     * Detects if the current hostname matches any supported site
     * @returns {Object|null} Site configuration object with domain, or null if not supported
     */
    detectCurrentSite() {
        for (const [domain, config] of Object.entries(SUPPORTED_SITES)) {
            if (this.currentHost.includes(domain)) {
                return { domain, ...config };
            }
        }
        return null;
    }

    /**
     * Check if current site is a supported clothing site
     * @returns {boolean} True if current site is supported
     */
    isSupportedSite() {
        return this.detectCurrentSite() !== null;
    }

    /**
     * Get supported site domains
     * @returns {string[]} Array of supported domain names
     */
    static getSupportedDomains() {
        return Object.keys(SUPPORTED_SITES);
    }
}

// Also expose on window for backward compatibility
if (typeof window !== 'undefined') {
    window.SiteDetector = SiteDetector;
}