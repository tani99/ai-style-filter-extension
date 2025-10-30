/**
 * Centralized prompts for AI analysis
 * All AI prompts used across the extension are defined here
 */

/**
 * Product analysis prompt - analyzes product against user's style profile
 * @param {Object} params - Prompt parameters
 * @param {string} params.altText - Image alt text
 * @param {string} params.imageContext - Additional image context
 * @param {Array<string>} params.bestColors - User's best colors
 * @param {Array<string>} params.avoidColors - Colors to avoid
 * @param {Array<string>} params.styleCategories - User's style categories
 * @param {Array<string>} params.aestheticKeywords - Aesthetic keywords
 * @param {Array<string>} params.recommendedPatterns - Recommended patterns
 * @param {Array<string>} params.avoidPatterns - Patterns to avoid
 * @returns {string} Formatted prompt
 */
export function buildProductAnalysisPrompt({
    altText,
    imageContext,
    bestColors,
    avoidColors,
    styleCategories,
    aestheticKeywords,
    recommendedPatterns,
    avoidPatterns
}) {
    return `Evaluate how good this clothing item will look on the user based on their style profile (which describes what tends to look good on them). Be grounded and specific. Base your judgment ONLY on what is visible in the image:

WHAT LOOKS GOOD ON THIS USER (Style Profile):
- Best colors: ${bestColors.join(', ')}
${avoidColors.length > 0 ? `- Avoid colors: ${avoidColors.join(', ')}` : ''}
- Style categories: ${styleCategories.join(', ')}
- Aesthetic: ${aestheticKeywords.join(', ')}
- Recommended patterns: ${recommendedPatterns.join(', ')}
${avoidPatterns.length > 0 ? `- Avoid patterns: ${avoidPatterns.join(', ')}` : ''}

TASK:
Rate how good this item will look on the user from 1-10. Be VERY STRICT and critical, and base your judgment on how well the visible qualities align with what tends to flatter this user (colors, patterns, silhouettes, aesthetic cues):
- 1-3: Likely unflattering for this user (major conflicts with colors, silhouette, aesthetic, or patterns)
- 4-6: Mixed or neutral (some flattering aspects but notable conflicts or uncertainties)
- 7-8: Will likely look good (aligns well with most flattering attributes, minor caveats)
- 9-10: Will look great (exceptional alignment with flattering colors, patterns, and aesthetic — award sparingly)

Be critical and selective. Most items should score 1-8. Only give 9-10 to items that are TRULY exceptional for this user.

ADDITIONALLY, provide a detailed description of this clothing item for virtual try-on image generation. Focus on:
- Type of garment (e.g., dress, shirt, pants, jacket, skirt)
- Colors (primary and secondary colors, patterns)
- Style details (cut, silhouette - e.g., A-line, bodycon, wrap, shift, straight-leg)
- **FIT & SIZE DETAILS** (VERY IMPORTANT):
  * Fit: tight/fitted/slim/regular/relaxed/loose/oversized/baggy
  * Length: cropped/short/knee-length/midi/maxi/ankle-length/floor-length/mini
  * Rise (for bottoms): low-rise/mid-rise/high-rise
  * Sleeve length: sleeveless/short-sleeve/three-quarter/long-sleeve
  * Overall proportions: how the garment sits on the body
- Material appearance (e.g., denim, cotton, leather, knit, silk, satin, chiffon)
- Key design features (e.g., buttons, zippers, pockets, ruffles, pleats, neckline style)
- Pattern/texture (e.g., solid, striped, floral, plaid, textured, ribbed)
- Overall aesthetic (e.g., casual, formal, sporty, bohemian, minimalist, vintage)

Respond in this exact format:
SCORE: [number 1-10]
REASON: [brief 1-2 sentence explanation focused on why it will (or will not) look good on this user, explicitly referencing 2-3 concrete factors from the profile such as best/avoid colors, recommended/avoid patterns, and aesthetic fit]
DESCRIPTION: [2-3 sentence detailed outfit description capturing all visual details, especially fit and length]

Example response:
SCORE: 8
REASON: Navy blazer aligns with best colors and classic aesthetic; structured, waist-length cut flatters proportions.
DESCRIPTION: Navy blue fitted blazer in a structured cotton-blend fabric with notched lapels and silver button closure. Features long sleeves with functional cuff buttons and a cropped length hitting at the waist. Slim, tailored fit with two front flap pockets and classic professional aesthetic.`;
}

/**
 * Prompt-based ranking prompt - analyzes product against user's text search query
 * @param {Object} params - Prompt parameters
 * @param {string} params.userPrompt - User's search query
 * @param {string} params.altText - Image alt text
 * @param {string} params.imageContext - Additional image context
 * @param {string} params.classificationInfo - Image classification results (if available)
 * @returns {string} Formatted prompt
 */
export function buildPromptRankingPrompt({
    userPrompt,
    altText,
    imageContext,
    classificationInfo = ''
}) {
    return `Analyze this clothing item image for how well it matches this specific search request. Base your analysis ONLY on the visual information in the image itself. Do not use alt text, file names, page text, or any external metadata.

USER IS LOOKING FOR: "${userPrompt}"

TASK:
Rate how well this item matches the user's specific request from 1-3:
- 1 (NO): Does not match the request at all (wrong item type, color, or style)
- 2 (MAYBE): Partially matches but missing key attributes from the request
- 3 (YES): Strong match - closely matches what the user is looking for

Be DECISIVE and specific. Consider ONLY what is visible:
- Item type match (e.g., if user wants "dress", this should be a dress)
- Color match (if user specifies color like "black", check if this matches)
- Style attributes (e.g., "A-line", "casual", "formal", "running")
- Pattern or material (if visible in the image)
- Overall visual relevance to the search query

IMPORTANT RULES:
- Base your decision solely on what you can see in the image
- Ignore alt text and any external text
- If the image clearly matches the request: score 3
- If the image clearly conflicts with the request: score 1
- If information is limited or ambiguous: score 2

Respond in this exact format:
SCORE: [number 1, 2, or 3]
REASON: [brief 1-sentence explanation based only on visible details]`;
}

/**
 * Outfit description prompt - generates detailed description of clothing item for virtual try-on
 * @param {Object} params - Prompt parameters
 * @param {string} params.altText - Image alt text
 * @param {string} params.imageContext - Additional image context
 * @returns {string} Formatted prompt
 */
export function buildOutfitDescriptionPrompt({
    altText,
    imageContext
}) {
    return `Describe this clothing item in detail for virtual try-on image generation, using ONLY what you can see in the image. Do not use alt text, file names, or any external text.

TASK:
Provide a detailed description of this clothing item that will help an AI image generator create accurate virtual try-on images. Focus on:
- Type of garment (e.g., dress, shirt, pants, jacket, skirt)
- Colors (primary and secondary colors, patterns)
- Style details (cut, silhouette - e.g., A-line, bodycon, wrap, shift, straight-leg)
- FIT & SIZE DETAILS (VERY IMPORTANT): fit, length, rise (for bottoms), sleeve length, and overall proportions
- Material appearance (e.g., denim, cotton, leather, knit, silk, satin, chiffon)
- Key design features (e.g., buttons, zippers, pockets, ruffles, pleats, neckline style)
- Pattern/texture (e.g., solid, striped, floral, plaid, textured, ribbed)
- Overall aesthetic (e.g., casual, formal, sporty, bohemian, minimalist, vintage)

Provide a concise but comprehensive description in 2-3 sentences that captures ALL important visual details, especially fit and length.

Respond with ONLY the description text, no additional formatting.`;
}
