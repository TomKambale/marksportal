process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const express = require('express');
const path = require('path');
const session = require('express-session');
require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

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

// ==================== HELPER FUNCTIONS ====================

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

// Helper function to get client IP
function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           'unknown';
}

// ==================== AUTHENTICATION ROUTES ====================

// Login route
app.post('/login', async (req, res) => {
    try {
        const { uname, pf, psw, remember } = req.body;
        const clientIp = getClientIp(req);
        
        const sql = 'SELECT * FROM users WHERE email = ? AND pf_number = ?';
        
        db.query(sql, [uname, pf], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
                return res.redirect('/login.html?error=' + encodeURIComponent('Database error occurred'));
            }
            
            if (results.length === 0) {
                return res.redirect('/login.html?error=' + encodeURIComponent('Invalid email or PF number'));
            }
            
            const user = results[0];
            
            if (user.status !== 'active') {
                return res.redirect('/login.html?error=' + encodeURIComponent('Account is inactive. Contact administrator.'));
            }
            
            const validPassword = await bcrypt.compare(psw, user.password_hash);
            
            if (!validPassword) {
                return res.redirect('/login.html?error=' + encodeURIComponent('Invalid password'));
            }
            
            // Update last login information
            const updateSql = 'UPDATE users SET last_login = NOW(), login_count = login_count + 1, last_ip = ? WHERE id = ?';
            db.query(updateSql, [clientIp, user.id], (updateErr) => {
                if (updateErr) console.error('Error updating last login:', updateErr);
            });
            
            // Store user in session
            req.session.user = {
                id: user.id,
                email: user.email,
                pf_no: user.pf_number,
                full_name: user.full_name,
                role: user.role
            };
            
            if (remember === 'on') {
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
            } else {
                req.session.cookie.maxAge = 24 * 60 * 60 * 1000;
            }
            
            if (user.role === 'admin') {
                res.redirect('/admin.html');
            } else {
                res.redirect('/semesters.html');
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.redirect('/login.html?error=' + encodeURIComponent('Login failed. Please try again.'));
    }
});

// Registration route
app.post('/register', async (req, res) => {
    try {
        const { email, pf_number, full_name, password } = req.body;
        
        if (!email.endsWith('@ttu.ac.ke')) {
            return res.redirect('/register.html?error=' + encodeURIComponent('Email must be from @ttu.ac.ke domain'));
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const sql = 'INSERT INTO users (email, pf_number, full_name, password_hash, role, status) VALUES (?, ?, ?, ?, "user", "inactive")';
        
        db.query(sql, [email, pf_number, full_name, hashedPassword], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.redirect('/register.html?error=' + encodeURIComponent('Email or PF Number already exists'));
                }
                console.error('Registration error:', err);
                return res.redirect('/register.html?error=' + encodeURIComponent('Registration failed. Please try again.'));
            }
            
            res.redirect('/login.html?message=' + encodeURIComponent('Registration successful! Please wait for admin approval.'));
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.redirect('/register.html?error=' + encodeURIComponent('Registration failed. Please try again.'));
    }
});

// Get current user endpoint
app.get('/api/current-user', (req, res) => {
    if (req.session.user) {
        return res.json({
            success: true,
            user: req.session.user
        });
    }
    return res.status(401).json({
        success: false,
        error: 'No active session'
    });
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

// ==================== PASSWORD RESET ROUTES ====================

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
            const resetToken = crypto.randomBytes(32).toString('hex');
            const tokenExpiry = new Date();
            tokenExpiry.setHours(tokenExpiry.getHours() + 1);
            
            const updateTokenSql = 'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?';
            db.query(updateTokenSql, [resetToken, tokenExpiry, user.id], (updateErr) => {
                if (updateErr) {
                    console.error('Error saving reset token:', updateErr);
                    return res.status(500).json({ success: false, error: 'Failed to process request' });
                }
                
                // In production, send email here
                res.json({ 
                    success: true, 
                    message: 'Password reset initiated. Use your reset token to set new password.',
                    resetToken: resetToken, // Remove in production
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
            const now = new Date();
            
            if (user.reset_token_expiry && new Date(user.reset_token_expiry) < now) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Reset token has expired. Please request a new one.' 
                });
            }
            
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            const updateSql = 'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?';
            
            db.query(updateSql, [hashedPassword, user.id], (updateErr) => {
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

// ==================== USER MANAGEMENT ROUTES (Admin Only) ====================

// Get all users with login info (admin only)
app.get('/api/admin/users-with-login', async (req, res) => {
    try {
        const currentUserEmail = req.session.user?.email;
        if (!currentUserEmail) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const checkAdminSql = 'SELECT role FROM users WHERE email = ?';
        
        db.query(checkAdminSql, [currentUserEmail], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0 || results[0].role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Admin access required' });
            }
            
            const sql = `SELECT 
                            id, email, pf_number, full_name, role, status, created_at,
                            last_login, login_count, last_ip,
                            CASE 
                                WHEN last_login IS NULL THEN 'Never'
                                WHEN DATEDIFF(NOW(), last_login) = 0 THEN 'Today'
                                WHEN DATEDIFF(NOW(), last_login) = 1 THEN 'Yesterday'
                                ELSE CONCAT(DATEDIFF(NOW(), last_login), ' days ago')
                            END as last_login_display
                        FROM users 
                        ORDER BY last_login DESC, created_at DESC`;
            
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

// Get all users (admin only) - simplified version
app.get('/api/admin/users', async (req, res) => {
    try {
        const currentUserEmail = req.session.user?.email;
        if (!currentUserEmail) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const checkAdminSql = 'SELECT role FROM users WHERE email = ?';
        
        db.query(checkAdminSql, [currentUserEmail], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0 || results[0].role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Admin access required' });
            }
            
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

// Get user last login info
app.get('/api/user/last-login/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserEmail = req.session.user?.email;
        
        if (!currentUserEmail) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const checkAdminSql = 'SELECT role FROM users WHERE email = ?';
        
        db.query(checkAdminSql, [currentUserEmail], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            const isAdmin = results.length > 0 && results[0].role === 'admin';
            
            let sql, params;
            if (isAdmin) {
                sql = 'SELECT id, email, full_name, role, last_login, login_count, last_ip, status FROM users WHERE id = ?';
                params = [userId];
            } else {
                sql = 'SELECT id, email, full_name, role, last_login, login_count FROM users WHERE id = ? AND id = ?';
                params = [userId, req.session.user.id];
            }
            
            db.query(sql, params, (err, userResults) => {
                if (err) {
                    return res.status(500).json({ success: false, error: 'Database error' });
                }
                
                if (userResults.length === 0) {
                    return res.status(404).json({ success: false, error: 'User not found' });
                }
                
                const user = userResults[0];
                let lastLoginFormatted = 'Never logged in';
                let lastLoginRelative = '';
                
                if (user.last_login) {
                    const lastLoginDate = new Date(user.last_login);
                    const now = new Date();
                    const diffHours = Math.floor((now - lastLoginDate) / (1000 * 60 * 60));
                    const diffDays = Math.floor(diffHours / 24);
                    
                    lastLoginFormatted = lastLoginDate.toLocaleString();
                    
                    if (diffHours < 1) {
                        lastLoginRelative = 'Just now';
                    } else if (diffHours < 24) {
                        lastLoginRelative = `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
                    } else {
                        lastLoginRelative = `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
                    }
                }
                
                res.json({
                    success: true,
                    user: {
                        id: user.id,
                        email: user.email,
                        full_name: user.full_name,
                        role: user.role,
                        last_login: user.last_login,
                        last_login_formatted: lastLoginFormatted,
                        last_login_relative: lastLoginRelative,
                        login_count: user.login_count || 0,
                        last_ip: user.last_ip || 'Not recorded',
                        status: user.status
                    }
                });
            });
        });
    } catch (error) {
        console.error('Error fetching last login:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create new user (admin only)
app.post('/api/admin/users', async (req, res) => {
    try {
        const { email, pf_number, full_name, role, status, password } = req.body;
        const currentUserEmail = req.session.user?.email;
        
        if (!currentUserEmail) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const checkAdminSql = 'SELECT role FROM users WHERE email = ?';
        
        db.query(checkAdminSql, [currentUserEmail], async (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0 || results[0].role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Admin access required' });
            }
            
            const checkSql = 'SELECT id FROM users WHERE email = ? OR pf_number = ?';
            db.query(checkSql, [email, pf_number], async (err, existing) => {
                if (err) {
                    return res.status(500).json({ success: false, error: 'Database error' });
                }
                
                if (existing.length > 0) {
                    return res.status(409).json({ success: false, error: 'User already exists' });
                }
                
                const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('default123', 10);
                const insertSql = `INSERT INTO users (email, pf_number, full_name, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)`;
                
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
        const currentUserEmail = req.session.user?.email;
        
        if (!currentUserEmail) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
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
        const currentUserEmail = req.session.user?.email;
        
        if (!currentUserEmail) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const checkAdminSql = 'SELECT role FROM users WHERE email = ?';
        
        db.query(checkAdminSql, [currentUserEmail], async (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0 || results[0].role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Admin access required' });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
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
        const currentUserEmail = req.session.user?.email;
        
        if (!currentUserEmail) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }
        
        const checkAdminSql = 'SELECT role, id FROM users WHERE email = ?';
        
        db.query(checkAdminSql, [currentUserEmail], (err, results) => {
            if (err) {
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (results.length === 0 || results[0].role !== 'admin') {
                return res.status(403).json({ success: false, error: 'Admin access required' });
            }
            
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

// ==================== ERP API ROUTES ====================

// API Route: Get semesters for logged-in lecturer
app.get('/api/semesters', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Not logged in' });
        }
        
        const { email, pf_no } = req.session.user;
        console.log('Fetching semesters for:', email, pf_no);
        
        const token = await getAccessToken();
        const apiUrl = `https://portal2.ttu.ac.ke/api/exam/v1/lecturer/semesters/`;
        
        let response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: email, pf_no: pf_no })
        });

        if (response.status === 405) {
            response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
        }

        if (response.status === 405) {
            response = await fetch(`${apiUrl}?lecturer=${encodeURIComponent(pf_no)}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const semesters = await response.json();
        const lecturerSemesters = Array.isArray(semesters) ? semesters.filter(s => s.lecturer === pf_no) : semesters;
        
        res.json({ success: true, semesters: lecturerSemesters });
        
    } catch (error) {
        console.error('Error fetching semesters:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API Route: Get classes for a specific semester
app.post('/api/classes', async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, error: 'Not logged in' });
        }
        
        const { semester } = req.body;
        const { pf_no } = req.session.user;
        
        const token = await getAccessToken();
        const apiUrl = `https://portal2.ttu.ac.ke/api/exam/v1/lecturer/classes/`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ semester: semester, pf_no: pf_no })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const classes = await response.json();
        res.json({ success: true, classes: classes });
        
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API Route: Get student marks for a class
app.post('/api/marks', async (req, res) => {
    try {
        const { programme_code, semester, stage, unit_code, exam_category } = req.body;
        
        if (!programme_code || !semester || !stage || !unit_code) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing required fields: programme_code, semester, stage, or unit_code' 
            });
        }
        
        const token = await getAccessToken();
        const apiUrl = `https://portal2.ttu.ac.ke/api/exam/v1/lecturer/class-list/`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ programme_code, semester, stage, unit_code, exam_category })
        });

        if (!response.ok) {
            const errorText = await response.text();
            return res.status(response.status).json({ 
                success: false, 
                error: `ERP API error: ${response.status} - ${errorText}` 
            });
        }

        const data = await response.json();
        res.json({
            success: true,
            class_list: data.class_list || [],
            exam_category: data.exam_category || null
        });
        
    } catch (error) {
        console.error('Error fetching marks:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API Route: Save student marks
app.post('/api/marks/save', async (req, res) => {
    try {
        const { unit_code, semester, pf_no, programme_code, stage, exam_category, student_no, cat_marks, exam_marks, academic_year } = req.body;
        
        console.log('Saving marks for:', { unit_code, semester, pf_no, programme_code, stage, student_no });
        
        const token = await getAccessToken();
        const apiUrl = `https://portal2.ttu.ac.ke/api/exam/v1/lecturer/add-marks/`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                unit_code, semester, pf_no, programme_code, stage,
                exam_category, student_no, cat_marks, exam_marks, academic_year
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        
        // Check for duplicate key errors
        let hasError = false;
        let errorMessages = [];
        
        if (result.cat_marks_added && typeof result.cat_marks_added === 'string') {
            if (result.cat_marks_added.includes('Violation of PRIMARY KEY') || 
                result.cat_marks_added.includes('duplicate key')) {
                hasError = true;
                errorMessages.push(`CAT marks already exist for student ${student_no}`);
            }
        }
        
        if (result.exam_marks_added && typeof result.exam_marks_added === 'string') {
            if (result.exam_marks_added.includes('Violation of PRIMARY KEY') || 
                result.exam_marks_added.includes('duplicate key')) {
                hasError = true;
                errorMessages.push(`Exam marks already exist for student ${student_no}`);
            }
        }
        
        if (hasError) {
            return res.status(409).json({ 
                success: false, 
                error: errorMessages.join('; '),
                errorType: 'duplicate_marks'
            });
        }
        
        res.json({ success: true, message: 'Marks saved successfully', result: result });
        
    } catch (error) {
        console.error('Error saving marks:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// API Route: Get access token (for testing)
app.get('/get-token', async (req, res) => {
    try {
        const token = await getAccessToken();
        res.json({ success: true, message: 'Token retrieved successfully', token: token });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== UPLOAD HISTORY ROUTES ====================

// Save upload batch
app.post('/api/upload/save-batch', async (req, res) => {
    let connection;
    try {
        const {
            batch_id, unit_code, unit_name, semester, academic_year,
            programme_code, stage, exam_category, records, success_count, error_count
        } = req.body;
        
        const lecturerId = req.session.user.id;
        const lecturerName = req.session.user.full_name;
        const lecturerPf = req.session.user.pf_no;
        
        connection = await db.promise().getConnection();
        await connection.beginTransaction();
        
        const batchSql = `
            INSERT INTO upload_batches 
            (batch_id, unit_code, unit_name, semester, academic_year, 
             programme_code, stage, exam_category, lecturer_id, lecturer_name, 
             lecturer_pf, total_records, success_count, error_count, status, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NOW())
        `;
        
        await connection.query(batchSql, [
            batch_id, unit_code, unit_name, semester, academic_year,
            programme_code, stage, exam_category, lecturerId, lecturerName,
            lecturerPf, records.length, success_count, error_count
        ]);
        
        if (records.length > 0) {
            const recordSql = `
                INSERT INTO upload_records 
                (batch_id, student_no, student_name, cat_marks, exam_marks, status, error_message)
                VALUES ?
            `;
            
            const recordValues = records.map(record => [
                batch_id,
                record.student_no,
                record.student_name || null,
                record.cat_marks || 0,
                record.exam_marks || 0,
                record.status || 'success',
                record.error_message || null
            ]);
            
            await connection.query(recordSql, [recordValues]);
        }
        
        await connection.commit();
        
        res.json({ success: true, message: 'Upload batch saved successfully', batch_id: batch_id });
        
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error saving upload batch:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Get upload history
app.get('/api/upload/history', async (req, res) => {
    try {
        const lecturerId = req.session.user.id;
        const { limit = 50, offset = 0 } = req.query;
        
        const sql = `
            SELECT 
                b.*,
                (SELECT COUNT(*) FROM upload_records WHERE batch_id = b.batch_id) as total_records_count,
                (SELECT COUNT(*) FROM upload_records WHERE batch_id = b.batch_id AND status = 'success') as success_records,
                (SELECT COUNT(*) FROM upload_records WHERE batch_id = b.batch_id AND status = 'error') as error_records
            FROM upload_batches b
            WHERE b.lecturer_id = ?
            ORDER BY b.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const [batches] = await db.promise().query(sql, [lecturerId, parseInt(limit), parseInt(offset)]);
        
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
        
        const [batch] = await db.promise().query(
            `SELECT * FROM upload_batches WHERE batch_id = ? AND lecturer_id = ?`,
            [batchId, lecturerId]
        );
        
        if (batch.length === 0) {
            return res.status(404).json({ success: false, error: 'Batch not found' });
        }
        
        const [records] = await db.promise().query(
            `SELECT * FROM upload_records WHERE batch_id = ? ORDER BY uploaded_at DESC`,
            [batchId]
        );
        
        res.json({
            success: true,
            batch: batch[0],
            records: records
        });
        
    } catch (error) {
        console.error('Error fetching batch details:', error);
        res.status(500).json({ success: false, error: error.message });
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

// Delete upload batch
app.delete('/api/upload/batch/:batchId', async (req, res) => {
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
        
        await db.promise().query(`DELETE FROM upload_batches WHERE batch_id = ?`, [batchId]);
        
        res.json({ success: true, message: 'Batch deleted successfully' });
        
    } catch (error) {
        console.error('Error deleting batch:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== TEST ROUTE ====================

app.get('/test', (req, res) => {
    console.log('TEST ROUTE HIT');
    res.send('Route works');
});

// ==================== START SERVER ====================

app.listen(3000, () => console.log('Server running on http://localhost:3000'));