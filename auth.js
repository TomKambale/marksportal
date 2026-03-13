// auth.js - Google OAuth Authentication Handler

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// Google Sign-In Callback
async function handleGoogleSignIn(response) {
    console.log('Google sign-in response received');
    
    const errorDiv = document.getElementById('error-message');
    errorDiv.style.display = 'none';
    
    try {
        // Extract id_token from Google response
        const idToken = response.credential;
        
        // Send token to backend
        const result = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ idToken })
        });
        
        const data = await result.json();
        
        if (!result.ok) {
            // Handle error responses
            throw new Error(data.error || 'Authentication failed');
        }
        
        // Store JWT in sessionStorage
        sessionStorage.setItem('ttu_token', data.token);
        
        // Decode token to get user info (optional, for verification)
        const tokenPayload = parseJwt(data.token);
        console.log('Logged in as:', tokenPayload.name);
        
        // Redirect to dashboard
        window.location.href = '/dashboard.html';
        
    } catch (error) {
        console.error('Authentication error:', error);
        
        // Display error message on login page
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
    }
}

// Helper function to parse JWT token (client-side, no verification)
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Error parsing JWT:', e);
        return null;
    }
}

// Check if user is already logged in
function checkExistingSession() {
    const token = sessionStorage.getItem('ttu_token');
    if (token) {
        // If on login page and already logged in, redirect to dashboard
        if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
            window.location.href = '/dashboard.html';
        }
    } else {
        // If not on login page and no token, redirect to login
        if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
            window.location.href = '/index.html';
        }
    }
}

// Run on page load
document.addEventListener('DOMContentLoaded', checkExistingSession);

// Make function available globally for Google callback
window.handleGoogleSignIn = handleGoogleSignIn;