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
 * @param {boolean} [params.hasImageAttached=false] - Whether an image will be attached to the Prompt API call
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
    avoidPatterns,
    hasImageAttached = false
}) {
    return `Rate how good the outfit in the attached image will look on the user based on their style profile.

USER'S STYLE PROFILE (what tends to look good on the user):
- Best colors that flatter the user: ${bestColors.join(', ')}
${avoidColors.length > 0 ? `- Colors to avoid on the user: ${avoidColors.join(', ')}` : ''}
- Preferred style categories on the user: ${styleCategories.join(', ')}
- User's aesthetic tendencies: ${aestheticKeywords.join(', ')}
- Patterns that suit the user: ${recommendedPatterns.join(', ')}
${avoidPatterns.length > 0 ? `- Patterns that usually don't suit the user: ${avoidPatterns.join(', ')}` : ''}

TASK:
Judge whether the outfit in the image will look good on the user based on the style profile above. Provide a strict 1-10 rating and a concise reason:
- 1-3: Unfavorable for the user (clashes with flattering colors/aesthetic; unflattering pattern/silhouette)
- 4-6: Mixed/uncertain for the user (some alignment but notable mismatches)
- 7-8: Likely to look good on the user (solid alignment with style profile)
- 9-10: Excellent for the user (strong alignment; visually very flattering) — reserve for truly exceptional cases

Then provide a detailed visual description of the garment for virtual try-on image generation. Focus on:
- Type of garment (e.g., dress, shirt, pants, jacket, skirt)
- Colors (primary/secondary; patterns)
- Style details (cut/silhouette — e.g., A-line, bodycon, wrap, shift, straight-leg)
- FIT & SIZE DETAILS (very important):
  * Fit: tight/fitted/slim/regular/relaxed/loose/oversized/baggy
  * Length: cropped/short/knee-length/midi/maxi/ankle-length/floor-length/mini
  * Rise (for bottoms): low-rise/mid-rise/high-rise
  * Sleeve length: sleeveless/short-sleeve/three-quarter/long-sleeve
  * Overall proportions: how the garment sits on the body
- Material appearance (e.g., denim, cotton, leather, knit, silk, satin, chiffon)
- Key design features (e.g., buttons, zippers, pockets, ruffles, pleats, neckline)
- Pattern/texture (e.g., solid, striped, floral, plaid, textured, ribbed)
- Overall aesthetic (e.g., casual, formal, sporty, bohemian, minimalist, vintage)

Respond in this exact format:
SCORE: [number 1-10]
REASON: [brief 1-sentence explanation tied to the user's style profile]
DESCRIPTION: [2-3 sentence detailed visual description capturing fit, length, and key features]`;
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
    return `Analyze this clothing item for how well it matches this specific search request:

USER IS LOOKING FOR: "${userPrompt}"

IMAGE CONTEXT:
- Alt text: "${altText}"
- ${imageContext}${classificationInfo}

TASK:
Rate how well this item matches the user's specific request from 1-3:
- 1 (NO): Does not match the request at all (wrong item type, color, or style)
- 2 (MAYBE): Partially matches but missing key attributes from the request
- 3 (YES): Strong match - closely matches what the user is looking for

Be DECISIVE and specific. Consider:
- Item type match (e.g., if user wants "dress", this should be a dress)
- Color match (if user specifies color like "black", check if this matches)
- Style attributes (e.g., "A-line", "casual", "formal", "running")
- Pattern or material (if specified in user's request)
- Overall relevance to the search query

IMPORTANT RULES:
- PRIORITIZE the image classification results (actual AI analysis of pixels) over alt text
- If image classification shows labels that match the user's request: higher score likely
- If image classification shows labels that conflict with the request: lower score likely
- Use alt text as secondary information to supplement the classification
- If the image classification clearly matches the request: score 3
- If the image classification conflicts with the request: score 1
- If information is limited or ambiguous: score 2

Respond in this exact format:
SCORE: [number 1, 2, or 3]
REASON: [brief 1-sentence explanation of why this matches or doesn't match the request]

Example 1 - Good match:
User prompt: "black A-line dress"
Alt text: "Black A-line midi dress with v-neck"
Response:
SCORE: 3
REASON: Black A-line dress matches all specified criteria perfectly.

Example 2 - Wrong item:
User prompt: "black A-line dress"
Alt text: "White floral maxi skirt"
Response:
SCORE: 1
REASON: This is a skirt, not a dress, and wrong color.

Example 3 - Partial match:
User prompt: "black A-line dress"
Alt text: "Black bodycon dress"
Response:
SCORE: 2
REASON: Black dress but bodycon style instead of A-line.`;
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
    return `Describe this clothing item in detail for virtual try-on image generation.

IMAGE CONTEXT:
- Alt text: "${altText}"
- ${imageContext}

TASK:
Provide a detailed description of this clothing item that will help an AI image generator create accurate virtual try-on images. Focus on:
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

Provide a concise but comprehensive description in 2-3 sentences that captures ALL important visual details, especially fit and length.

Example responses:
"Black fitted leather jacket with silver zipper closure, notched lapels, and zippered pockets. Features long sleeves with zippered cuffs and a cropped length hitting at the waist. Tight, body-hugging fit with classic moto-style and edgy hardware details."

"Floral midi dress in a soft pink and white pattern with small roses. Features a loose, flowy A-line silhouette, short flutter sleeves, and a v-neckline with button details. Knee-length hem with relaxed fit made from lightweight cotton, romantic feminine aesthetic."

"Navy blue slim-fit chinos in a cotton twill fabric. Mid-rise waist with slightly tapered leg and ankle-length hem. Fitted through hip and thigh with classic five-pocket design, smart casual style."

"Oversized white linen button-down shirt with long sleeves and collar. Loose, relaxed fit hitting mid-thigh length with dropped shoulders and chest pocket. Breezy casual aesthetic perfect for layering."

Respond with ONLY the description text, no additional formatting.`;
}
