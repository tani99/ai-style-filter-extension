// FirebaseAuthManager.js
// Manages Firebase Authentication for the Chrome extension

class FirebaseAuthManager {
  constructor(auth) {
    this.auth = auth;
    this.currentUser = null;

    // Listen to auth state changes
    this.auth.onAuthStateChanged((user) => {
      this.currentUser = user;
      this.onAuthStateChanged(user);
    });
  }

  async loginWithEmail(email, password) {
    try {
      console.log('🔐 Attempting login with email:', email);
      const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
      console.log('✅ Login successful:', userCredential.user.uid);

      return {
        success: true,
        user: {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: userCredential.user.displayName
        }
      };
    } catch (error) {
      console.error('❌ Login failed:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  async signUpWithEmail(email, password, displayName) {
    try {
      console.log('📝 Attempting sign up with email:', email);
      const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);

      // Update display name
      if (displayName) {
        await userCredential.user.updateProfile({
          displayName: displayName
        });
      }

      console.log('✅ Sign up successful:', userCredential.user.uid);

      return {
        success: true,
        user: {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: displayName
        }
      };
    } catch (error) {
      console.error('❌ Sign up failed:', error);
      return {
        success: false,
        error: this.getErrorMessage(error.code)
      };
    }
  }

  async logout() {
    try {
      console.log('🚪 Logging out...');
      await this.auth.signOut();
      console.log('✅ Logout successful');
      return { success: true };
    } catch (error) {
      console.error('❌ Logout failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return this.currentUser !== null;
  }

  onAuthStateChanged(user) {
    console.log('🔄 Auth state changed:', user ? `Logged in as ${user.email}` : 'Logged out');

    // Notify other parts of extension about auth state
    chrome.runtime.sendMessage({
      action: 'authStateChanged',
      user: user ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName
      } : null
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }

  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/invalid-email': 'Invalid email address',
      'auth/user-disabled': 'This account has been disabled',
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'Email already registered',
      'auth/weak-password': 'Password should be at least 6 characters',
      'auth/network-request-failed': 'Network error. Please check your connection',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
      'auth/invalid-credential': 'Invalid email or password'
    };

    return errorMessages[errorCode] || 'Authentication failed. Please try again.';
  }
}

// Export for use in background.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseAuthManager;
}
