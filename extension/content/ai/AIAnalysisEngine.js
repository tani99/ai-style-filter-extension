import { ImageClassifier } from './ImageClassifier.js';
import { AltTextAnalyzer } from './AltTextAnalyzer.js';

/**
 * AIAnalysisEngine coordinates AI-powered clothing detection
 * using image classification and alt text analysis
 */
export class AIAnalysisEngine {
    constructor() {
        // Initialize AI components for detection only
        this.imageClassifier = new ImageClassifier();
        this.altTextAnalyzer = new AltTextAnalyzer();
    }

    /**
     * Check if image shows clothing using AI
     * @param {HTMLImageElement} img - Image element to analyze
     * @returns {Promise<Object>} Detection result
     */
    async isClothingImage(img) {
        return await this.imageClassifier.isClothingImage(img);
    }

    /**
     * Test all AI components
     * @returns {Promise<Object>} Test results
     */
    async testAllComponents() {
        const results = {
            imageClassifier: await this.imageClassifier.testClassificationFunctionality(),
            altTextAnalyzer: await this.altTextAnalyzer.testAIFunctionality()
        };

        console.log('🧪 AI Components Test Results:', results);
        return results;
    }

    /**
     * Check if AI components are ready
     * @returns {Promise<boolean>} True if components are ready
     */
    async isAIReady() {
        const classifierReady = this.imageClassifier.isAIReady();
        const altTextReady = this.altTextAnalyzer.isAIReady();
        return classifierReady && altTextReady;
    }

    /**
     * Refresh AI availability for all components
     * @returns {Promise<Object>} Availability status
     */
    async refreshAIAvailability() {
        const availability = {
            imageClassifier: await this.imageClassifier.refreshAIAvailability(),
            altTextAnalyzer: await this.altTextAnalyzer.refreshAIAvailability()
        };

        console.log('🔄 AI Availability Status:', availability);
        return availability;
    }
}

// Also expose on window for backward compatibility
if (typeof window !== 'undefined') {
    window.AIAnalysisEngine = AIAnalysisEngine;
}