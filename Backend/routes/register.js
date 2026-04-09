// routes/register.js
const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

// POST /register
router.post('/register', async (req, res) => {
    console.log('REGISTER ROUTE HIT');
    console.log('BODY RECEIVED:', req.body);

    const { uname, pf, name, psw } = req.body;

    // Check all fields are present
    if (!uname || !pf || !name || !psw) {
        console.warn('Missing field in payload');
        return res.status(400).send('All fields are required');
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(psw, 10);

        // Check if user exists
        const checkSql = 'SELECT * FROM users WHERE email = ? OR pf_number = ?';
        db.query(checkSql, [uname, pf], (err, results) => {
            if (err) {
                console.error('CHECK QUERY ERROR:', err);
                return res.status(500).send('Database error');
            }

            if (results.length > 0) {
                console.warn('User already exists:', results);
                return res.status(409).send('User with this email or PF number already exists');
            }

            // Insert new user
            const insertSql = `
                INSERT INTO users (email, pf_number, full_name, password_hash)
                VALUES (?, ?, ?, ?)
            `;

            db.query(insertSql, [uname, pf, name, hashedPassword], (err, result) => {
                if (err) {
                    console.error('INSERT QUERY ERROR:', err);
                    return res.status(500).send('Failed to register user');
                }

                console.log('USER INSERTED:', { id: result.insertId, email: uname });
                res.send('Registration successful');
            });
        });

    } catch (error) {
        console.error('SERVER ERROR:', error);
        res.status(500).send('Server error');
    }
});

module.exports = router;