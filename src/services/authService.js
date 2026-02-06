const API_URL = 'https://asadmindset.com/wp-json';
const GOOGLE_CLIENT_ID = '667060896472-7l179s9cfmjmiuv6au75i9p52hhnhl9p.apps.googleusercontent.com';

// Auth state change listeners
let authListeners = [];

export const authService = {
  // Add listener for auth state changes
  addAuthListener(callback) {
    authListeners.push(callback);
    return () => {
      authListeners = authListeners.filter(cb => cb !== callback);
    };
  },

  // Notify all listeners of auth state change
  notifyAuthChange(isAuthenticated) {
    authListeners.forEach(cb => cb(isAuthenticated));
  },

  // Always remember me (persistent login)
  isRememberMe() {
    return true;
  },

  // Set remember me preference (kept for compatibility)
  setRememberMe(value) {
    localStorage.setItem('rememberMe', 'true');
  },

  // Always use localStorage for persistent login
  _getStorage() {
    return localStorage;
  },

  // No-op: token check not needed with 30-day tokens
  startTokenCheck() {},
  stopTokenCheck() {},
  // Google Client ID
  getGoogleClientId() {
    return GOOGLE_CLIENT_ID;
  },

  // Google Login
  async googleLogin(credential) {
    const response = await fetch(`${API_URL}/cutify/v1/google-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Google login failed');
    }

    const token = data.data?.token || data.token;
    const userEmail = data.data?.email || data.user_email;
    const userName = data.data?.displayName || data.user_display_name;
    const userNicename = data.data?.nicename || data.user_nicename;

    if (!token) {
      throw new Error('No token received');
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({
      email: userEmail,
      name: userName,
      nicename: userNicename,
    }));

    // Start token validation timer
    this.startTokenCheck();

    return data;
  },

  // Login
  async login(username, password) {
    const response = await fetch(`${API_URL}/jwt-auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    console.log('Login response:', data);

    const token = data.data?.token || data.token;
    const userEmail = data.data?.email || data.user_email;
    const userName = data.data?.displayName || data.user_display_name;
    const userNicename = data.data?.nicename || data.user_nicename;

    if (!token) {
      throw new Error('No token received');
    }

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({
      email: userEmail,
      name: userName,
      nicename: userNicename,
    }));

    // Start token validation timer
    this.startTokenCheck();

    return data;
  },

  // Logout
  logout(shouldReload = true) {
    this.stopTokenCheck();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    if (shouldReload) {
      window.location.reload();
    }
  },

  // Get token
  getToken() {
    return localStorage.getItem('token');
  },

  // Get user info
  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // Check if logged in
  isLoggedIn() {
    return !!this.getToken();
  },

  // Validate token
  async validateToken() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const response = await fetch(`${API_URL}/asadmindset/v1/token/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  // Check token and handle expiry - use this before API calls
  async ensureValidToken() {
    const isValid = await this.validateToken();
    if (!isValid) {
      this.logout(false);
      this.notifyAuthChange(false);
      return false;
    }
    return true;
  },

  // Update profile (name)
  async updateProfile(name) {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const response = await fetch(`${API_URL}/cutify/v1/update-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ name }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Update failed');
    }

    const user = this.getUser();
    user.name = data.name;
    localStorage.setItem('user', JSON.stringify(user));

    return data;
  },

  // Change password
  async changePassword(currentPassword, newPassword) {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/cutify/v1/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ 
        current_password: currentPassword,
        new_password: newPassword 
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Password change failed');
    }

    return data;
  },

  // ========== Orders API ==========
  
  // Create new order
  async createOrder(orderData) {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/cutify/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create order');
    }

    return data;
  },

  // Get my orders list
  async getMyOrders() {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/cutify/v1/my-orders`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch orders');
    }

    return data;
  },

  // Get single order details
  async getMyOrder(orderId) {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/cutify/v1/my-orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch order');
    }

    return data;
  },

  // Upload video
  async uploadVideo(file) {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/wp/v2/media`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to upload video');
    }

    return {
      url: data.source_url,
      id: data.id
    };
  },

  // Send message for order
  async sendMessage(orderId, message) {
    const token = this.getToken();
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/cutify/v1/orders/${orderId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send message');
    }

    return data;
  },

  // Handle API response and check for auth errors
  handleApiResponse(response) {
    if (response.status === 401 || response.status === 403) {
      // Token is invalid or expired
      this.logout(false);
      this.notifyAuthChange(false);
      throw new Error('Session expired. Please login again.');
    }
    return response;
  },

  // Make authenticated fetch request with auto-logout on 401
  async authenticatedFetch(url, options = {}) {
    const token = this.getToken();
    
    if (!token) {
      this.notifyAuthChange(false);
      throw new Error('Not authenticated');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
    };

    const response = await fetch(url, { ...options, headers });
    
    // If token expired, handle it
    if (response.status === 401 || response.status === 403) {
      this.logout(false);
      this.notifyAuthChange(false);
      throw new Error('Session expired. Please login again.');
    }

    return response;
  },
};