// FirestoreWardrobeManager.js
// Manages Firestore wardrobe data with real-time sync

class FirestoreWardrobeManager {
  constructor(db) {
    this.db = db;
    this.listeners = new Map();
    this.cache = {
      items: [],
      looks: []
    };
  }

  setupListeners(userId) {
    console.log('👗 Setting up Firestore listeners for user:', userId);

    // Listen to wardrobe items (flat structure with userId field)
    const itemsListener = this.db
      .collection('wardrobeItems')
      .where('userId', '==', userId)
      .onSnapshot(
        (snapshot) => {
          console.log(`📦 Received ${snapshot.size} wardrobe items from Firestore`);

          this.cache.items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          // Store in chrome.storage for faster access
          chrome.storage.local.set({
            wardrobeItems: this.cache.items,
            lastSyncTimestamp: Date.now()
          });

          console.log('✅ Wardrobe items cached locally:', this.cache.items.length);

          // Notify content scripts
          this.notifyDataUpdated('items', this.cache.items);
        },
        (error) => {
          console.error('❌ Error listening to wardrobe items:', error);
        }
      );

    this.listeners.set('items', itemsListener);

    // Listen to looks/outfits (flat structure with userId field)
    const looksListener = this.db
      .collection('looks')
      .where('userId', '==', userId)
      .onSnapshot(
        (snapshot) => {
          console.log(`👔 Received ${snapshot.size} looks from Firestore`);

          this.cache.looks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          chrome.storage.local.set({
            looks: this.cache.looks
          });

          console.log('✅ Looks cached locally:', this.cache.looks.length);

          this.notifyDataUpdated('looks', this.cache.looks);
        },
        (error) => {
          console.error('❌ Error listening to looks:', error);
        }
      );

    this.listeners.set('looks', looksListener);
  }

  cleanupListeners() {
    console.log('🧹 Cleaning up Firestore listeners');

    this.listeners.forEach((unsubscribe) => {
      unsubscribe();
    });

    this.listeners.clear();
    this.cache = { items: [], looks: [] };

    // Clear cached data
    chrome.storage.local.remove(['wardrobeItems', 'looks', 'lastSyncTimestamp']);
  }

  notifyDataUpdated(type, data) {
    chrome.runtime.sendMessage({
      action: 'wardrobeDataUpdated',
      type: type,
      data: data,
      count: data.length
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }

  async getItems(userId, filters = {}) {
    // Use cache if available
    if (this.cache.items.length > 0) {
      return this.filterItems(this.cache.items, filters);
    }

    // Fetch from Firestore (flat structure)
    try {
      let query = this.db
        .collection('wardrobeItems')
        .where('userId', '==', userId);

      // Apply filters
      if (filters.category) {
        query = query.where('category', '==', filters.category);
      }

      const snapshot = await query.get();
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`📦 Fetched ${items.length} items from Firestore for user ${userId}`);
      return items;
    } catch (error) {
      console.error('❌ Error fetching items:', error);
      return [];
    }
  }

  async getLooks(userId) {
    if (this.cache.looks.length > 0) {
      return this.cache.looks;
    }

    try {
      const snapshot = await this.db
        .collection('looks')
        .where('userId', '==', userId)
        .get();

      const looks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`👔 Fetched ${looks.length} looks from Firestore for user ${userId}`);
      return looks;
    } catch (error) {
      console.error('❌ Error fetching looks:', error);
      return [];
    }
  }

  filterItems(items, filters) {
    let filtered = [...items];

    if (filters.category) {
      filtered = filtered.filter(item => item.category === filters.category);
    }

    if (filters.style) {
      filtered = filtered.filter(item =>
        item.style && item.style.includes(filters.style)
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        (item.tags && item.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    return filtered;
  }

  getCachedData() {
    return {
      items: this.cache.items,
      looks: this.cache.looks
    };
  }

  getStats() {
    return {
      itemCount: this.cache.items.length,
      lookCount: this.cache.looks.length,
      hasData: this.cache.items.length > 0 || this.cache.looks.length > 0
    };
  }
}

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirestoreWardrobeManager;
}
