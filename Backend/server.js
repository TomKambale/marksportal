process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcrypt');

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

// Forgot password - Request password reset
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email, pf_number } = req.body;
        
        if (!email || !pf_number) {
            return res.status(400).json({ 
                success: false, 
                error: 'Email and PF Number are required' 
            });
        }
        
        // Find user by email and PF number
        const findUserSql = 'SELECT id, email, pf_number, full_name FROM users WHERE email = ? AND pf_number = ?';
        
        db.query(findUserSql, [email, pf_number], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'No user found with these credentials' 
                });
            }
            
            const user = results[0];
            
            // Generate a random reset token
            const crypto = require('crypto');
            const resetToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiry = new Date();
            tokenExpiry.setHours(tokenExpiry.getHours() + 1); // Token valid for 1 hour
            
            // Store token in database (you'll need to add these columns to users table)
            const updateTokenSql = 'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?';
            db.query(updateTokenSql, [resetToken, tokenExpiry, user.id], (updateErr) => {
                if (updateErr) {
                    console.error('Error saving reset token:', updateErr);
                    return res.status(500).json({ success: false, error: 'Failed to process request' });
                }
                
                // In production, send email with reset link
                // For now, return the token (in production, email this to user)
                res.json({ 
                    success: true, 
                    message: 'Password reset initiated. Use your reset token to set new password.',
                    resetToken: resetToken, // Remove this in production - should be emailed
                    userId: user.id
                });
            });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reset password with token
app.post('/api/reset-password', async (req, res) => {
    try {
        const { resetToken, newPassword, confirmPassword } = req.body;
        
        if (!resetToken || !newPassword || !confirmPassword) {
            return res.status(400).json({ 
                success: false, 
                error: 'Reset token and new password are required' 
            });
        }
        
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ 
                success: false, 
                error: 'Passwords do not match' 
            });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ 
                success: false, 
                error: 'Password must be at least 6 characters long' 
            });
        }
        
        // Find user by reset token
        const findUserSql = 'SELECT id, email, reset_token_expiry FROM users WHERE reset_token = ?';
        
        db.query(findUserSql, [resetToken], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ 
                    success: false, 
                    error: 'Invalid or expired reset token' 
                });
            }
            
            const user = results[0];
            
            // Check if token has expired
            const now = new Date();
            if (user.reset_token_expiry && new Date(user.reset_token_expiry) < now) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Reset token has expired. Please request a new one.' 
                });
            }
            
            // Hash the new password
            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
            // Update password and clear reset token
            const updateSql = 'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?';
            db.query(updateSql, [hashedPassword, user.id], (updateErr, result) => {
                if (updateErr) {
                    console.error('Password reset error:', updateErr);
                    return res.status(500).json({ success: false, error: 'Failed to reset password' });
                }
                
                res.json({ 
                    success: true, 
                    message: 'Password reset successfully! You can now login with your new password.' 
                });
            });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get current user endpoint
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

// Get user role by email
app.get('/api/user-role/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const sql = 'SELECT role FROM users WHERE email = ?';
        
        db.query(sql, [email], (err, results) => {
            if (err) {
                console.error('Error fetching user role:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            
            res.json({ success: true, role: results[0].role });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all users (admin only)
app.get('/api/admin/users', async (req, res) => {
    try {
        // Check if current user is admin
        const currentUserEmail = req.session.user.email;
        const checkAdminSql = 'SELECT role FROM users WHERE email = ?';
        
        db.query(checkAdminSql, [currentUserEmail], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0 || results[0].role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Admin access required' });
            }
            
            // Fetch all users
            const sql = 'SELECT id, email, pf_number, full_name, role, status, created_at FROM users ORDER BY id DESC';
            db.query(sql, (err, users) => {
                if (err) {
                    return res.status(500).json({ success: false, error: 'Database error' });
                }
                res.json({ success: true, users });
            });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new user (admin only)
app.post('/api/admin/users', async (req, res) => {
    try {
        const { email, pf_number, full_name, role, status, password } = req.body;
        
        // Validate admin access
        const currentUserEmail = req.session.user.email;
        const checkAdminSql = 'SELECT role FROM users WHERE email = ?';
        
        db.query(checkAdminSql, [currentUserEmail], async (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0 || results[0].role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Admin access required' });
            }
            
            // Check if user exists
            const checkSql = 'SELECT id FROM users WHERE email = ? OR pf_number = ?';
            db.query(checkSql, [email, pf_number], async (err, existing) => {
                if (err) {
                    return res.status(500).json({ success: false, error: 'Database error' });
                }
                
                if (existing.length > 0) {
                    return res.status(409).json({ success: false, error: 'User already exists' });
                }
                
                // Hash password
                const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('default123', 10);
                
                // Insert new user
                const insertSql = `
                    INSERT INTO users (email, pf_number, full_name, password_hash, role, status)
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                db.query(insertSql, [email, pf_number, full_name, hashedPassword, role, status], (err, result) => {
                    if (err) {
                        console.error('Insert error:', err);
                        return res.status(500).json({ success: false, error: 'Failed to create user' });
                    }
                    
                    res.json({ success: true, message: 'User created successfully', userId: result.insertId });
                });
            });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update user (admin only)
app.put('/api/admin/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { email, pf_number, full_name, role, status, password } = req.body;
        
        // Validate admin access
        const currentUserEmail = req.session.user.email;
        const checkAdminSql = 'SELECT role FROM users WHERE email = ?';
        
        db.query(checkAdminSql, [currentUserEmail], async (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0 || results[0].role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Admin access required' });
            }
            
            let updateSql = 'UPDATE users SET email = ?, pf_number = ?, full_name = ?, role = ?, status = ?';
            let params = [email, pf_number, full_name, role, status];
            
            if (password && password.trim() !== '') {
                const hashedPassword = await bcrypt.hash(password, 10);
                updateSql += ', password_hash = ?';
                params.push(hashedPassword);
            }
            
            updateSql += ' WHERE id = ?';
            params.push(userId);
            
            db.query(updateSql, params, (err, result) => {
                if (err) {
                    console.error('Update error:', err);
                    return res.status(500).json({ success: false, error: 'Failed to update user' });
                }
                
                if (result.affectedRows === 0) {
                    return res.status(404).json({ success: false, error: 'User not found' });
                }
                
                res.json({ success: true, message: 'User updated successfully' });
            });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reset user password (admin only)
app.post('/api/admin/users/:id/reset-password', async (req, res) => {
    try {
        const userId = req.params.id;
        const { password } = req.body;
        
        // Validate admin access
        const currentUserEmail = req.session.user.email;
        const checkAdminSql = 'SELECT role FROM users WHERE email = ?';
        
        db.query(checkAdminSql, [currentUserEmail], async (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0 || results[0].role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Admin access required' });
            }
            
            // Hash the new password
            const hashedPassword = await bcrypt.hash(password, 10);
            
            // Update password
            const updateSql = 'UPDATE users SET password_hash = ? WHERE id = ?';
            db.query(updateSql, [hashedPassword, userId], (err, result) => {
                if (err) {
                    console.error('Password reset error:', err);
                    return res.status(500).json({ success: false, error: 'Failed to reset password' });
                }
                
                if (result.affectedRows === 0) {
                    return res.status(404).json({ success: false, error: 'User not found' });
                }
                
                res.json({ success: true, message: 'Password reset successfully' });
            });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete user (admin only)
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        
        // Validate admin access
        const currentUserEmail = req.session.user.email;
        const checkAdminSql = 'SELECT role, id FROM users WHERE email = ?';
        
        db.query(checkAdminSql, [currentUserEmail], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0 || results[0].role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Admin access required' });
            }
            
            // Prevent admin from deleting themselves
            if (results[0].id === parseInt(userId)) {
                return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
            }
            
            const deleteSql = 'DELETE FROM users WHERE id = ?';
            db.query(deleteSql, [userId], (err, result) => {
                if (err) {
                    console.error('Delete error:', err);
                    return res.status(500).json({ success: false, error: 'Failed to delete user' });
                }
                
                if (result.affectedRows === 0) {
                    return res.status(404).json({ success: false, error: 'User not found' });
                }
                
                res.json({ success: true, message: 'User deleted successfully' });
            });
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
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
        const { programme_code, semester, stage, unit_code, exam_category } = req.body;
        
        console.log('=== FETCHING MARKS ===');
        console.log('Received payload:', { programme_code, semester, stage, unit_code, exam_category });
        
        // Validate required fields
        if (!programme_code || !semester || !stage || !unit_code) {
            console.error('Missing required fields');
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: programme_code, semester, stage, or unit_code' 
            });
        }
        
        const token = await getAccessToken();
        
        // Call the ERP API for student marks
        const apiUrl = `https://portal2.ttu.ac.ke/api/exam/v1/lecturer/class-list/`;
        
        const requestBody = {
            programme_code: programme_code,
            semester: semester,
            stage: stage,
            unit_code: unit_code,
            exam_category: exam_category
        };
        
        console.log('Sending to ERP API:', requestBody);
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log('ERP API Response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            return res.status(response.status).json({ 
                success: false, 
                error: `ERP API error: ${response.status} - ${errorText}` 
            });
        }

        const data = await response.json();
        console.log('ERP API Response data structure:', Object.keys(data));
        console.log('class_list length:', data.class_list?.length || 0);
        
        // Return the data as-is from ERP
        res.json({
            success: true,
            class_list: data.class_list || [],
            exam_category: data.exam_category || null
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
        const { unit_code, semester, pf_no, programme_code, stage, exam_category, student_no, cat_marks, exam_marks, academic_year } = req.body;
        
        console.log('Saving marks for:', { unit_code, semester, pf_no, programme_code, stage });
        // console.log('Marks data:', marks.length, 'students');
        
        const token = await getAccessToken();
        
        // Call the ERP API to save marks
        const apiUrl = `https://portal2.ttu.ac.ke/api/exam/v1/lecturer/add-marks/`;
        
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
                // marks: marks,
                student_no: student_no,
                cat_marks: cat_marks,
                exam_marks: exam_marks,
                academic_year: academic_year
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

// API Route: Get access token (for testing)
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

// Test route to verify server is working
app.get('/test', (req, res) => {
    console.log('TEST ROUTE HIT');
    res.send('Route works');
});

// Routes
app.use('/', require('./routes/register'));
app.use('/', require('./routes/login'));

// Start server
app.listen(3000, () => console.log('Server running on http://localhost:3000'));