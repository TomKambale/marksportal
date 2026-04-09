process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const app = express();

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Parse URL-encoded POST data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Token retrieval function
async function getAccessToken() {
    const API_BASE = process.env.API_BASE || "https://portal2.ttu.ac.ke";
    const tokenUrl = `${API_BASE}/api/token/`;
    
    console.log('Attempting to connect to:', tokenUrl);
    console.log('Using username:', process.env.API_USERNAME);
    
    const credentials = {
        username: process.env.API_USERNAME,
        password: process.env.API_PASSWORD
    };

    try {
        console.log('Sending request...');
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(credentials)
        });

        console.log('Response status:', response.status);
        
        if (response.ok) {
            const tokens = await response.json();
            const accessToken = tokens.access;
            console.log('✅ Token retrieved successfully');
            return accessToken;
        } else {
            const errorText = await response.text();
            console.error('Server responded with error:', response.status);
            console.error('Error details:', errorText);
            throw new Error(`Token request failed: ${errorText}`);
        }
    } catch (error) {
        console.error('Error getting access token:', error.message);
        
        if (error.code === 'ENOTFOUND') {
            console.error('❌ Cannot find the server - check if portal2.ttu.ac.ke is correct and reachable');
        } else if (error.code === 'ECONNREFUSED') {
            console.error('❌ Server refused connection - it might be down or blocking you');
        } else if (error.code === 'CERT_HAS_EXPIRED') {
            console.error('❌ SSL certificate expired');
        }
        
        throw error;
    }
}

// API Route: Get semesters for logged-in lecturer
app.get('/api/semesters', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Not logged in' });
        }
        
        const { email, pf_no } = req.session.user;
        console.log('Fetching semesters for:', email, pf_no);
        
        // Get the access token
        const token = await getAccessToken();
        
        // Call the ERP API - TRY DIFFERENT METHODS
        const apiUrl = `https://portal2.ttu.ac.ke/api/exam/v1/lecturer/semesters/`;
        
        // Option 1: Try POST with lecturer info in body
        console.log('Trying POST request...');
        let response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                pf_no: pf_no
            })
        });

        // If POST fails with 405, try GET
        if (response.status === 405) {
            console.log('POST returned 405, trying GET...');
            response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }

        // If still failing, try with lecturer as query parameter
        if (response.status === 405) {
            console.log('GET returned 405, trying with query params...');
            response = await fetch(`${apiUrl}?lecturer=${encodeURIComponent(pf_no)}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        }

        console.log('Final response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const semesters = await response.json();
        console.log('Semesters received:', semesters.length);
        
        // Filter semesters for this specific lecturer if needed
        const lecturerSemesters = Array.isArray(semesters) ? semesters.filter(s => s.lecturer === pf_no) : semesters;
        
        res.json({
            success: true,
            semesters: lecturerSemesters
        });
        
    } catch (error) {
        console.error('Error fetching semesters:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Test route
app.get('/get-token', async (req, res) => {
    try {
        const token = await getAccessToken();
        res.json({ 
            success: true, 
            message: 'Token retrieved successfully',
            token: token
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.get('/test', (req, res) => {
    console.log('TEST ROUTE HIT');
    res.send('Route works');
});

// Routes
app.use('/', require('./routes/register'));
app.use('/', require('./routes/login'));

// Start server
app.listen(3000, () => console.log('Server running on http://localhost:3000'));