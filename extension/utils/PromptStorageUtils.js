/**
 * Storage utility functions for prompt-based ranking mode
 * Manages user prompts, ranking mode state, and prompt history
 */

/**
 * Save user prompt and switch to prompt mode
 * @param {string} prompt - User's search prompt
 * @returns {Promise<void>}
 */
export async function saveUserPrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') {
        throw new Error('Invalid prompt: must be a non-empty string');
    }

    // Validate and trim prompt
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length === 0) {
        throw new Error('Prompt cannot be empty');
    }

    if (trimmedPrompt.length > 200) {
        throw new Error('Prompt too long: maximum 200 characters');
    }

    console.log('[PromptStorage] Saving user prompt:', trimmedPrompt);

    // Save prompt and switch to prompt mode
    await chrome.storage.local.set({
        userPrompt: trimmedPrompt,
        rankingMode: 'prompt'
    });

    // Update recent prompts list (keep last 5 unique prompts)
    const { recentPrompts = [] } = await chrome.storage.local.get(['recentPrompts']);

    // Remove if already exists to avoid duplicates
    const filteredPrompts = recentPrompts.filter(p => p !== trimmedPrompt);

    // Add to front and limit to 5
    const updatedRecent = [trimmedPrompt, ...filteredPrompts].slice(0, 5);

    await chrome.storage.local.set({ recentPrompts: updatedRecent });

    // Add to prompt history with metadata
    await addToPromptHistory(trimmedPrompt);

    console.log('[PromptStorage] Prompt saved successfully');
    console.log('[PromptStorage] Recent prompts:', updatedRecent);
}

/**
 * Add prompt to history with timestamp
 * @param {string} prompt - User's search prompt
 * @returns {Promise<void>}
 */
async function addToPromptHistory(prompt) {
    const { promptHistory = [] } = await chrome.storage.local.get(['promptHistory']);

    const historyEntry = {
        prompt: prompt,
        timestamp: Date.now(),
        resultsCount: 0 // Will be updated when results are available
    };

    // Add to history (keep last 20)
    const updatedHistory = [historyEntry, ...promptHistory].slice(0, 20);

    await chrome.storage.local.set({ promptHistory: updatedHistory });

    console.log('[PromptStorage] Added to history:', historyEntry);
}

/**
 * Update results count for the most recent prompt in history
 * @param {number} count - Number of results found
 * @returns {Promise<void>}
 */
export async function updatePromptResultsCount(count) {
    const { promptHistory = [] } = await chrome.storage.local.get(['promptHistory']);

    if (promptHistory.length > 0) {
        promptHistory[0].resultsCount = count;
        await chrome.storage.local.set({ promptHistory });
        console.log('[PromptStorage] Updated results count for most recent prompt:', count);
    }
}

/**
 * Get current user prompt
 * @returns {Promise<string>} Current prompt or empty string
 */
export async function getUserPrompt() {
    const { userPrompt = '' } = await chrome.storage.local.get(['userPrompt']);
    return userPrompt;
}

/**
 * Get current ranking mode
 * @returns {Promise<string>} 'style' or 'prompt'
 */
export async function getRankingMode() {
    const { rankingMode = 'style' } = await chrome.storage.local.get(['rankingMode']);
    return rankingMode;
}

/**
 * Set ranking mode
 * @param {string} mode - 'style' or 'prompt'
 * @returns {Promise<void>}
 */
export async function setRankingMode(mode) {
    if (mode !== 'style' && mode !== 'prompt') {
        throw new Error('Invalid ranking mode: must be "style" or "prompt"');
    }

    console.log('[PromptStorage] Setting ranking mode to:', mode);

    await chrome.storage.local.set({ rankingMode: mode });

    // If switching to style mode, clear current prompt
    if (mode === 'style') {
        await chrome.storage.local.set({ userPrompt: '' });
        console.log('[PromptStorage] Cleared user prompt (switched to style mode)');
    }
}

/**
 * Get recent prompts
 * @returns {Promise<string[]>} Array of recent prompts (max 5)
 */
export async function getRecentPrompts() {
    const { recentPrompts = [] } = await chrome.storage.local.get(['recentPrompts']);
    return recentPrompts;
}

/**
 * Get prompt history
 * @returns {Promise<Array<Object>>} Array of prompt history entries
 */
export async function getPromptHistory() {
    const { promptHistory = [] } = await chrome.storage.local.get(['promptHistory']);
    return promptHistory;
}

/**
 * Clear user prompt and switch to style mode
 * @returns {Promise<void>}
 */
export async function clearUserPrompt() {
    console.log('[PromptStorage] Clearing user prompt and switching to style mode');

    await chrome.storage.local.set({
        userPrompt: '',
        rankingMode: 'style'
    });
}

/**
 * Get all prompt-related storage data
 * @returns {Promise<Object>} All prompt storage data
 */
export async function getPromptStorageData() {
    const data = await chrome.storage.local.get([
        'userPrompt',
        'rankingMode',
        'recentPrompts',
        'promptHistory'
    ]);

    return {
        userPrompt: data.userPrompt || '',
        rankingMode: data.rankingMode || 'style',
        recentPrompts: data.recentPrompts || [],
        promptHistory: data.promptHistory || []
    };
}

/**
 * Clear all prompt history and recent prompts
 * @returns {Promise<void>}
 */
export async function clearPromptHistory() {
    console.log('[PromptStorage] Clearing all prompt history');

    await chrome.storage.local.set({
        recentPrompts: [],
        promptHistory: []
    });
}

// Export all functions for use in other modules
if (typeof window !== 'undefined') {
    window.PromptStorageUtils = {
        saveUserPrompt,
        updatePromptResultsCount,
        getUserPrompt,
        getRankingMode,
        setRankingMode,
        getRecentPrompts,
        getPromptHistory,
        clearUserPrompt,
        getPromptStorageData,
        clearPromptHistory
    };
}
