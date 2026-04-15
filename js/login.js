const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

router.post('/login', (req, res) => {
    console.log('LOGIN ROUTE HIT');
    console.log('BODY RECEIVED:', req.body);

    const { uname, pf, psw } = req.body;

    const sql = `
        SELECT * FROM users 
        WHERE email = ? AND pf_number = ?
    `;

    db.query(sql, [uname, pf], async (err, results) => {
        if (err) {
            console.error(err);
            return res.send('Login error');
        }

        if (results.length === 0) {
            console.log('User not found with email:', uname, 'and pf:', pf);
            return res.send('User not found');
        }

        const user = results[0];
        console.log('User found:', user.email);
        console.log('Stored password hash:', user.password_hash);
        console.log('Provided password:', psw);

        // Check if password_hash exists and is valid
        if (!user.password_hash) {
            console.error('No password hash found for user');
            return res.send('Account configuration error');
        }

        try {
            // Compare password
            const match = await bcrypt.compare(psw, user.password_hash);
            console.log('Password match result:', match);

            if (!match) {
                return res.send('Incorrect password');
                res.json({
        success: true,
        message: 'Login successful',
        user: {
            email: user.email,
            pf_no: user.pf_number,
            full_name: user.full_name,
            role: user.role || 'user'
        }
    });
            }

            fetch('/login', {
    method: 'POST',
    body: formData
})
.then(response => response.json())
.then(data => {
    if (data.success) {
        // Save user data
        localStorage.setItem('userEmail', data.user.email);
        localStorage.setItem('userPfNo', data.user.pf_no);
        localStorage.setItem('userName', data.user.full_name);
        // Redirect to semesters page
        window.location.href = 'semesters.html';
    }
});

            // res.send(`Welcome ${user.full_name}`);
            res.redirect('/semesters.html');
        } catch (compareErr) {
            console.error('Error comparing passwords:', compareErr);
            res.send('Password verification error');
        }
    });
});

module.exports = router;