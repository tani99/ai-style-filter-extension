// Site-specific configuration for e-commerce site detection and selectors
window.SUPPORTED_SITES = {
    'zara.com': {
        name: 'Zara',
        productPagePatterns: ['/product/', '/p/', '/item/'],
        categoryPagePatterns: ['/category/', '/c/', '/shop/'],
        isClothingSite: true,
        selectors: {
            productImages: [
                '.media-image img',
                '.product-detail-images img',
                '.product-media img',
                '.gallery-image img',
                'img[data-testid*="image"]'
            ],
            productCards: [
                '.product-card',
                '.product-item',
                '.grid-card',
                '[data-testid="product"]'
            ],
            productLinks: [
                'a[href*="/product/"]',
                'a[href*="/p/"]',
                '.product-link'
            ]
        }
    },
    'hm.com': {
        name: 'H&M',
        productPagePatterns: ['/product/', '/p/', '/item/'],
        categoryPagePatterns: ['/category/', '/c/', '/shop/', '/women/', '/men/', '/kids/'],
        isClothingSite: true,
        selectors: {
            productImages: [
                '.product-detail-main-image img',
                '.product-item img',
                '.hm-product-item img',
                '.item-image img',
                'img[data-src*="product"]'
            ],
            productCards: [
                '.product-item',
                '.hm-product-item',
                '.item-link',
                '.product-card'
            ],
            productLinks: [
                'a[href*="/product/"]',
                'a[href*="/p/"]',
                '.item-link'
            ]
        }
    },
    'nike.com': {
        name: 'Nike',
        productPagePatterns: ['/product/', '/p/', '/item/', '/t/'],
        categoryPagePatterns: ['/category/', '/c/', '/shop/', '/men/', '/women/', '/kids/'],
        isClothingSite: true,
        selectors: {
            productImages: [
                '.product-image img',
                '.hero-image img',
                '.pdp-image img',
                'img[data-sub*="product"]',
                '.wall-image img'
            ],
            productCards: [
                '.product-card',
                '.product-tile',
                '.grid-product-card',
                '[data-testid*="product"]'
            ],
            productLinks: [
                'a[href*="/t/"]',
                'a[href*="/product/"]',
                '.product-card-link'
            ]
        }
    }
};