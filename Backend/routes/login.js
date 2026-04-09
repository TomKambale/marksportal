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
            return res.status(500).send('Login error');
        }

        if (results.length === 0) {
            console.log('User not found with email:', uname, 'and pf:', pf);
            return res.send('User not found');
        }

        const user = results[0];
        console.log('User found:', user.email);

        // Check if password_hash exists
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
            }

            // Store user data in session
            req.session.user = {
                email: user.email,
                pf_no: user.pf_number,
                full_name: user.full_name
            };
            
            console.log('User stored in session, redirecting...');
            // Redirect to semesters page - MAKE SURE THIS IS THE ONLY RESPONSE
            return res.redirect('/semesters.html');

        } catch (compareErr) {
            console.error('Error comparing passwords:', compareErr);
            return res.send('Password verification error');
        }
    });
});

module.exports = router;