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
};

app.get('/api/current-user', (req, res) => {
    if (req.session.user) {
        return res.json({
            success: true,
            user: req.session.user
        });
    } else {
        return res.status(401).json({
            success: false,
            error: 'No active session'
        });
    }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ success: false, error: 'Logout failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

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

// API Route: Get classes for a specific semester
app.post('/api/classes', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Not logged in' });
        }
        
        const { semester } = req.body;
        const { pf_no, email } = req.session.user;
        
        console.log('Fetching classes for semester:', semester);
        console.log('Lecturer PF:', pf_no);
        
        // Get the access token
        const token = await getAccessToken();
        
        // Call the ERP API for classes
        const apiUrl = `https://portal2.ttu.ac.ke/api/exam/v1/lecturer/classes/`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                semester: semester,
                pf_no: pf_no
            })
        });

        console.log('API Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const classes = await response.json();
        console.log('Classes received:', classes.length);
        
        res.json({
            success: true,
            classes: classes
        });
        
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API Route: Get student marks for a class
app.post('/api/marks', async (req, res) => {
    try {
        const { unit_code, semester, pf_no, programme_code, stage } = req.body;
        
        console.log('Fetching marks for:', { unit_code, semester, pf_no, programme_code, stage });
        
        const token = await getAccessToken();
        
        // Call the ERP API for student marks
        const apiUrl = `https://portal2.ttu.ac.ke/api/exam/v1/lecturer/class-list/`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                unit_code: unit_code,
                semester: semester,
                pf_no: pf_no,
                programme_code: programme_code,
                stage: stage
            })
        });

        console.log('ERP API Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const students = await response.json();
        console.log('Students received:', students.length);
        
        res.json({
            success: true,
            students: students
        });
        
    } catch (error) {
        console.error('Error fetching marks:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API Route: Save student marks
app.post('/api/marks/save', async (req, res) => {
    try {
        const { unit_code, semester, pf_no, programme_code, stage, exam_category, marks } = req.body;
        
        console.log('Saving marks for:', { unit_code, semester, pf_no, programme_code, stage });
        console.log('Marks data:', marks.length, 'students');
        
        const token = await getAccessToken();
        
        // Call the ERP API to save marks
        const apiUrl = `https://portal2.ttu.ac.ke/api/exam/v1/lecturer/class-list/`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                unit_code: unit_code,
                semester: semester,
                pf_no: pf_no,
                programme_code: programme_code,
                stage: stage,
                exam_category: exam_category,
                marks: marks
            })
        });

        console.log('Save API Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Save successful:', result);
        
        res.json({
            success: true,
            message: 'Marks saved successfully',
            result: result
        });
        
    } catch (error) {
        console.error('Error saving marks:', error);
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