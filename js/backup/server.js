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

// Reports Start
app.post('/api/upload/save-batch', async (req, res) => {
    let connection;
    try {
        const {
            batch_id,
            unit_code,
            unit_name,
            semester,
            academic_year,
            programme_code,
            stage,
            exam_category,
            records,
            success_count,
            error_count,
            duplicate_count = 0
        } = req.body;
        
        const lecturerId = req.session.user.id;
        const lecturerName = req.session.user.full_name;
        const lecturerPf = req.session.user.pf_no;
        const startedAt = req.body.started_at || new Date();
        const completedAt = new Date();
        
        // Get connection for transaction
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        
        // 1. Insert into upload_batches
        const batchSql = `
            INSERT INTO upload_batches 
            (batch_id, unit_code, unit_name, semester, academic_year, 
             programme_code, stage, exam_category, lecturer_id, lecturer_name, 
             lecturer_pf, total_records, success_count, error_count, 
             duplicate_count, status, started_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
        `;
        
        await connection.query(batchSql, [
            batch_id, unit_code, unit_name, semester, academic_year,
            programme_code, stage, exam_category, lecturerId, lecturerName,
            lecturerPf, records.length, success_count, error_count,
            duplicate_count, startedAt, completedAt
        ]);
        
        // 2. Insert individual records into upload_records
        if (records.length > 0) {
            const recordSql = `
                INSERT INTO upload_records 
                (batch_id, student_no, student_name, cat_marks, exam_marks, 
                 status, error_message, error_code, erp_response, erp_status_code)
                VALUES ?
            `;
            
            const recordValues = records.map(record => [
                batch_id,
                record.student_no,
                record.student_name || null,
                record.cat_marks || 0,
                record.exam_marks || 0,
                record.status || 'success',
                record.error_message || null,
                record.error_code || null,
                record.erp_response || null,
                record.erp_status_code || null
            ]);
            
            await connection.query(recordSql, [recordValues]);
        }
        
        // 3. Update or insert unit_performance
        const unitPerfSql = `
            INSERT INTO unit_performance 
            (unit_code, unit_name, semester, academic_year, total_uploads, 
             total_students_uploaded, avg_cat_marks, avg_exam_marks, 
             lecturers, last_upload_date)
            VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                total_uploads = total_uploads + 1,
                total_students_uploaded = total_students_uploaded + VALUES(total_students_uploaded),
                avg_cat_marks = (avg_cat_marks * (total_uploads - 1) + VALUES(avg_cat_marks)) / total_uploads,
                avg_exam_marks = (avg_exam_marks * (total_uploads - 1) + VALUES(avg_exam_marks)) / total_uploads,
                lecturers = JSON_ARRAY_APPEND(lecturers, '$', ?),
                last_upload_date = VALUES(last_upload_date)
        `;
        
        // Calculate averages for this batch
        let totalCat = 0, totalExam = 0;
        records.forEach(record => {
            if (record.status === 'success') {
                totalCat += record.cat_marks || 0;
                totalExam += record.exam_marks || 0;
            }
        });
        const avgCat = records.filter(r => r.status === 'success').length > 0 
            ? totalCat / records.filter(r => r.status === 'success').length 
            : 0;
        const avgExam = records.filter(r => r.status === 'success').length > 0 
            ? totalExam / records.filter(r => r.status === 'success').length 
            : 0;
        
        await connection.query(unitPerfSql, [
            unit_code, unit_name, semester, academic_year,
            records.filter(r => r.status === 'success').length,
            avgCat, avgExam,
            JSON.stringify({ id: lecturerId, name: lecturerName, pf: lecturerPf }),
            completedAt
        ]);
        
        // 4. Update or insert lecturer_upload_activity
        const lecturerActivitySql = `
            INSERT INTO lecturer_upload_activity 
            (lecturer_id, lecturer_name, total_uploads, total_students_uploaded, 
             total_successful_uploads, total_failed_uploads, last_upload_date, 
             first_upload_date, success_rate)
            VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                total_uploads = total_uploads + 1,
                total_students_uploaded = total_students_uploaded + VALUES(total_students_uploaded),
                total_successful_uploads = total_successful_uploads + VALUES(total_successful_uploads),
                total_failed_uploads = total_failed_uploads + VALUES(total_failed_uploads),
                last_upload_date = VALUES(last_upload_date),
                success_rate = ((total_successful_uploads + VALUES(total_successful_uploads)) / 
                               (total_students_uploaded + VALUES(total_students_uploaded))) * 100
        `;
        
        await connection.query(lecturerActivitySql, [
            lecturerId, lecturerName,
            records.filter(r => r.status === 'success').length,
            success_count, error_count,
            completedAt, completedAt,
            (success_count / records.length) * 100
        ]);
        
        // 5. Log errors to upload_errors_log if any
        if (error_count > 0) {
            const errorRecords = records.filter(r => r.status === 'error');
            for (const errorRecord of errorRecords) {
                const errorLogSql = `
                    INSERT INTO upload_errors_log 
                    (error_code, error_message, error_type, occurrence_count, 
                     first_seen, last_seen, affected_students, affected_units)
                    VALUES (?, ?, ?, 1, NOW(), NOW(), ?, ?)
                    ON DUPLICATE KEY UPDATE
                        occurrence_count = occurrence_count + 1,
                        last_seen = NOW(),
                        affected_students = JSON_ARRAY_APPEND(affected_students, '$', ?),
                        affected_units = JSON_ARRAY_APPEND(affected_units, '$', ?)
                `;
                
                await connection.query(errorLogSql, [
                    errorRecord.error_code || 'UNKNOWN_ERROR',
                    errorRecord.error_message || 'Unknown error occurred',
                    errorRecord.error_type || 'unknown',
                    JSON_ARRAY(errorRecord.student_no),
                    JSON_ARRAY(unit_code),
                    errorRecord.student_no,
                    unit_code
                ]);
            }
        }
        
        // 6. Update dashboard metrics cache
        await updateDashboardMetricsCache(connection);
        
        await connection.commit();
        
        res.json({
            success: true,
            message: 'Upload batch saved successfully',
            batch_id: batch_id,
            stats: {
                total: records.length,
                success: success_count,
                errors: error_count,
                duplicates: duplicate_count
            }
        });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error saving upload batch:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Helper function to update dashboard cache
async function updateDashboardMetricsCache(connection) {
    try {
        // Get today's summary
        const [todaySummary] = await connection.query(`
            SELECT 
                COUNT(DISTINCT batch_id) as batches,
                SUM(total_records) as records,
                SUM(success_count) as successful,
                SUM(error_count) as errors
            FROM upload_batches
            WHERE DATE(created_at) = CURDATE()
        `);
        
        // Get weekly summary
        const [weekSummary] = await connection.query(`
            SELECT 
                COUNT(DISTINCT batch_id) as batches,
                SUM(total_records) as records,
                SUM(success_count) as successful,
                SUM(error_count) as errors
            FROM upload_batches
            WHERE YEARWEEK(created_at) = YEARWEEK(CURDATE())
        `);
        
        // Get overall success rate
        const [overallStats] = await connection.query(`
            SELECT 
                SUM(total_records) as total_records,
                SUM(success_count) as total_successful,
                ROUND(AVG(success_count / NULLIF(total_records, 0)) * 100, 2) as avg_success_rate
            FROM upload_batches
            WHERE status = 'completed'
        `);
        
        const cacheData = {
            today: todaySummary[0] || { batches: 0, records: 0, successful: 0, errors: 0 },
            week: weekSummary[0] || { batches: 0, records: 0, successful: 0, errors: 0 },
            overall: overallStats[0] || { total_records: 0, total_successful: 0, avg_success_rate: 0 },
            last_updated: new Date()
        };
        
        await connection.query(`
            INSERT INTO dashboard_metrics_cache (metric_key, metric_value)
            VALUES ('dashboard_summary', ?)
            ON DUPLICATE KEY UPDATE metric_value = ?
        `, [JSON.stringify(cacheData), JSON.stringify(cacheData)]);
        
    } catch (error) {
        console.error('Error updating dashboard cache:', error);
    }
}

// Get upload history with filters
app.get('/api/upload/history', async (req, res) => {
    try {
        const lecturerId = req.session.user.id;
        const { 
            limit = 50, 
            offset = 0, 
            unit_code, 
            semester, 
            status,
            start_date,
            end_date 
        } = req.query;
        
        let sql = `
            SELECT 
                b.*,
                (SELECT COUNT(*) FROM upload_records WHERE batch_id = b.batch_id) as total_records_count,
                (SELECT COUNT(*) FROM upload_records WHERE batch_id = b.batch_id AND status = 'success') as success_records,
                (SELECT COUNT(*) FROM upload_records WHERE batch_id = b.batch_id AND status = 'error') as error_records,
                (SELECT COUNT(*) FROM upload_records WHERE batch_id = b.batch_id AND status = 'duplicate') as duplicate_records,
                ROUND((SELECT COUNT(*) FROM upload_records WHERE batch_id = b.batch_id AND status = 'success') / 
                      NULLIF((SELECT COUNT(*) FROM upload_records WHERE batch_id = b.batch_id), 0) * 100, 2) as success_rate
            FROM upload_batches b
            WHERE b.lecturer_id = ?
        `;
        
        const params = [lecturerId];
        
        if (unit_code) {
            sql += ` AND b.unit_code = ?`;
            params.push(unit_code);
        }
        
        if (semester) {
            sql += ` AND b.semester = ?`;
            params.push(semester);
        }
        
        if (status) {
            sql += ` AND b.status = ?`;
            params.push(status);
        }
        
        if (start_date && end_date) {
            sql += ` AND DATE(b.created_at) BETWEEN ? AND ?`;
            params.push(start_date, end_date);
        }
        
        sql += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));
        
        const [batches] = await db.promise().query(sql, params);
        
        // Get total count for pagination
        const [countResult] = await db.promise().query(
            `SELECT COUNT(*) as total FROM upload_batches WHERE lecturer_id = ?`,
            [lecturerId]
        );
        
        res.json({
            success: true,
            batches: batches,
            total: countResult[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
    } catch (error) {
        console.error('Error fetching upload history:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get detailed batch report
app.get('/api/upload/batch/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const lecturerId = req.session.user.id;
        
        // Get batch details
        const [batch] = await db.promise().query(
            `SELECT * FROM upload_batches WHERE batch_id = ? AND lecturer_id = ?`,
            [batchId, lecturerId]
        );
        
        if (batch.length === 0) {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }
        
        // Get records with pagination
        const { page = 1, limit = 100 } = req.query;
        const offset = (page - 1) * limit;
        
        const [records] = await db.promise().query(
            `SELECT * FROM upload_records WHERE batch_id = ? ORDER BY uploaded_at DESC LIMIT ? OFFSET ?`,
            [batchId, parseInt(limit), parseInt(offset)]
        );
        
        const [totalCount] = await db.promise().query(
            `SELECT COUNT(*) as total FROM upload_records WHERE batch_id = ?`,
            [batchId]
        );
        
        res.json({
            success: true,
            batch: batch[0],
            records: records,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total: totalCount[0].total,
                total_pages: Math.ceil(totalCount[0].total / limit)
            }
        });
        
    } catch (error) {
        console.error('Error fetching batch details:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get dashboard metrics
app.get('/api/upload/dashboard-metrics', async (req, res) => {
    try {
        const lecturerId = req.session.user.id;
        
        // Try to get from cache first
        const [cached] = await db.promise().query(
            `SELECT metric_value FROM dashboard_metrics_cache WHERE metric_key = 'dashboard_summary'`
        );
        
        if (cached.length > 0) {
            const cacheAge = Date.now() - new Date(cached[0].last_updated).getTime();
            if (cacheAge < 300000) { // Cache valid for 5 minutes
                return res.json({
                    success: true,
                    metrics: JSON.parse(cached[0].metric_value),
                    from_cache: true
                });
            }
        }
        
        // Get fresh metrics
        const [todayStats] = await db.promise().query(`
            SELECT 
                COUNT(DISTINCT batch_id) as total_batches,
                SUM(total_records) as total_records,
                SUM(success_count) as successful_records,
                SUM(error_count) as error_records,
                ROUND(AVG(success_count / NULLIF(total_records, 0)) * 100, 2) as success_rate
            FROM upload_batches
            WHERE lecturer_id = ? AND DATE(created_at) = CURDATE()
        `, [lecturerId]);
        
        const [weekStats] = await db.promise().query(`
            SELECT 
                COUNT(DISTINCT batch_id) as total_batches,
                SUM(total_records) as total_records,
                SUM(success_count) as successful_records,
                SUM(error_count) as error_records,
                ROUND(AVG(success_count / NULLIF(total_records, 0)) * 100, 2) as success_rate
            FROM upload_batches
            WHERE lecturer_id = ? AND YEARWEEK(created_at) = YEARWEEK(CURDATE())
        `, [lecturerId]);
        
        const [overallStats] = await db.promise().query(`
            SELECT 
                COUNT(DISTINCT batch_id) as total_batches,
                SUM(total_records) as total_records,
                SUM(success_count) as successful_records,
                SUM(error_count) as error_records,
                ROUND(AVG(success_count / NULLIF(total_records, 0)) * 100, 2) as success_rate,
                MAX(created_at) as last_upload
            FROM upload_batches
            WHERE lecturer_id = ? AND status = 'completed'
        `, [lecturerId]);
        
        const [topUnits] = await db.promise().query(`
            SELECT 
                unit_code,
                unit_name,
                COUNT(*) as upload_count,
                SUM(total_records) as total_students
            FROM upload_batches
            WHERE lecturer_id = ?
            GROUP BY unit_code, unit_name
            ORDER BY upload_count DESC
            LIMIT 5
        `, [lecturerId]);
        
        const metrics = {
            today: todayStats[0] || { total_batches: 0, total_records: 0, successful_records: 0, error_records: 0, success_rate: 0 },
            week: weekStats[0] || { total_batches: 0, total_records: 0, successful_records: 0, error_records: 0, success_rate: 0 },
            overall: overallStats[0] || { total_batches: 0, total_records: 0, successful_records: 0, error_records: 0, success_rate: 0 },
            top_units: topUnits,
            last_updated: new Date()
        };
        
        res.json({
            success: true,
            metrics: metrics,
            from_cache: false
        });
        
    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get lecturer performance report
app.get('/api/upload/lecturer-performance', async (req, res) => {
    try {
        const lecturerId = req.session.user.id;
        
        const [performance] = await db.promise().query(`
            SELECT 
                lecturer_name,
                total_uploads,
                total_students_uploaded,
                total_successful_uploads,
                total_failed_uploads,
                ROUND(success_rate, 2) as success_rate,
                last_upload_date,
                first_upload_date,
                units_taught
            FROM lecturer_upload_activity
            WHERE lecturer_id = ?
        `, [lecturerId]);
        
        res.json({
            success: true,
            performance: performance[0] || null
        });
        
    } catch (error) {
        console.error('Error fetching lecturer performance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get unit performance report
app.get('/api/upload/unit-performance', async (req, res) => {
    try {
        const lecturerId = req.session.user.id;
        const { unit_code } = req.query;
        
        let sql = `
            SELECT 
                u.unit_code,
                u.unit_name,
                u.semester,
                u.academic_year,
                u.total_uploads,
                u.total_students_uploaded,
                ROUND(u.avg_cat_marks, 2) as avg_cat_marks,
                ROUND(u.avg_exam_marks, 2) as avg_exam_marks,
                u.last_upload_date,
                b.success_count as last_upload_success,
                b.total_records as last_upload_total
            FROM unit_performance u
            LEFT JOIN upload_batches b ON u.unit_code = b.unit_code 
                AND u.semester = b.semester 
                AND u.academic_year = b.academic_year
                AND b.lecturer_id = ?
            WHERE u.unit_code IN (SELECT DISTINCT unit_code FROM upload_batches WHERE lecturer_id = ?)
        `;
        
        const params = [lecturerId, lecturerId];
        
        if (unit_code) {
            sql += ` AND u.unit_code = ?`;
            params.push(unit_code);
        }
        
        sql += ` ORDER BY u.last_upload_date DESC`;
        
        const [units] = await db.promise().query(sql, params);
        
        res.json({
            success: true,
            units: units
        });
        
    } catch (error) {
        console.error('Error fetching unit performance:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete upload batch
app.delete('/api/upload/batch/:batchId', async (req, res) => {
    let connection;
    try {
        const { batchId } = req.params;
        const lecturerId = req.session.user.id;
        
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        
        // Check if batch exists and belongs to user
        const [batch] = await connection.query(
            `SELECT * FROM upload_batches WHERE batch_id = ? AND lecturer_id = ?`,
            [batchId, lecturerId]
        );
        
        if (batch.length === 0) {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }
        
        // Delete records (cascade will handle upload_records)
        await connection.query(`DELETE FROM upload_batches WHERE batch_id = ?`, [batchId]);
        
        await connection.commit();
        
        // Update cache after deletion
        await updateDashboardMetricsCache(connection);
        
        res.json({ success: true, message: 'Batch deleted successfully' });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error deleting batch:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Export batch report as CSV
app.get('/api/upload/export/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const lecturerId = req.session.user.id;
        
        const [batch] = await db.promise().query(
            `SELECT * FROM upload_batches WHERE batch_id = ? AND lecturer_id = ?`,
            [batchId, lecturerId]
        );
        
        if (batch.length === 0) {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }
        
        const [records] = await db.promise().query(
            `SELECT * FROM upload_records WHERE batch_id = ? ORDER BY uploaded_at`,
            [batchId]
        );
        
        // Generate CSV
        let csv = 'Student No,Student Name,CAT Marks,Exam Marks,Status,Error Message,Uploaded At\n';
        records.forEach(record => {
            csv += `"${record.student_no}","${record.student_name || ''}",${record.cat_marks},${record.exam_marks},${record.status},"${record.error_message || ''}","${record.uploaded_at}"\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=upload_report_${batchId}.csv`);
        res.send(csv);
        
    } catch (error) {
        console.error('Error exporting batch:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get summary report by type
app.get('/api/upload/summary-report', async (req, res) => {
    try {
        const lecturerId = req.session.user.id;
        const { report_type = 'monthly', period_start, period_end } = req.query;
        
        let startDate, endDate;
        
        if (period_start && period_end) {
            startDate = period_start;
            endDate = period_end;
        } else {
            // Default to current month
            startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            endDate = new Date();
        }
        
        // Check if cached report exists
        const [cachedReport] = await db.promise().query(`
            SELECT * FROM upload_summary_reports 
            WHERE lecturer_id = ? AND report_type = ? 
                AND DATE(period_start) = DATE(?) 
                AND DATE(period_end) = DATE(?)
            ORDER BY generated_at DESC LIMIT 1
        `, [lecturerId, report_type, startDate, endDate]);
        
        if (cachedReport.length > 0) {
            const reportAge = Date.now() - new Date(cachedReport[0].generated_at).getTime();
            if (reportAge < 3600000) { // Cache valid for 1 hour
                return res.json({
                    success: true,
                    report: cachedReport[0],
                    from_cache: true
                });
            }
        }
        
        // Generate fresh report
        const [data] = await db.promise().query(`
            SELECT 
                COUNT(DISTINCT batch_id) as total_batches,
                SUM(total_records) as total_records_uploaded,
                SUM(success_count) as total_successful,
                SUM(error_count) as total_errors,
                SUM(duplicate_count) as total_duplicates,
                ROUND(AVG(success_count / NULLIF(total_records, 0)) * 100, 2) as avg_success_rate,
                AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)) as avg_upload_time_seconds,
                JSON_OBJECTAGG(unit_code, total_records) as unit_breakdown,
                JSON_OBJECTAGG(programme_code, total_records) as programme_breakdown
            FROM upload_batches
            WHERE lecturer_id = ? 
                AND DATE(created_at) BETWEEN ? AND ?
                AND status = 'completed'
        `, [lecturerId, startDate, endDate]);
        
        const reportData = data[0];
        
        // Save to cache
        const reportId = `RPT_${report_type}_${Date.now()}`;
        await db.promise().query(`
            INSERT INTO upload_summary_reports 
            (report_id, lecturer_id, report_type, period_start, period_end, 
             total_batches, total_records_uploaded, total_successful, 
             total_errors, total_duplicates, avg_success_rate, 
             avg_upload_time_seconds, unit_breakdown, programme_breakdown)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            reportId, lecturerId, report_type, startDate, endDate,
            reportData.total_batches || 0,
            reportData.total_records_uploaded || 0,
            reportData.total_successful || 0,
            reportData.total_errors || 0,
            reportData.total_duplicates || 0,
            reportData.avg_success_rate || 0,
            reportData.avg_upload_time_seconds || 0,
            reportData.unit_breakdown || '{}',
            reportData.programme_breakdown || '{}'
        ]);
        
        res.json({
            success: true,
            report: {
                report_id: reportId,
                report_type: report_type,
                period_start: startDate,
                period_end: endDate,
                ...reportData
            },
            from_cache: false
        });
        
    } catch (error) {
        console.error('Error generating summary report:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reports end
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