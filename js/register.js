const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');

const router = express.Router();

router.post('/register.js', async (req, res) => {
    const { uname, pf, name, psw } = req.body;

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(psw, 10);

        // Check if user exists
        const checkSql = "SELECT * FROM users WHERE email = ? OR pf_number = ?";
        db.query(checkSql, [uname, pf], (err, results) => {
            if (results.length > 0) {
                return res.send('User already exists');
            }

            // Insert user
            const insertSql = `
                INSERT INTO users (email, pf_number, full_name, password_hash)
                VALUES (?, ?, ?, ?)
            `;

            db.query(insertSql, [uname, pf, name, hashedPassword], (err) => {
                if (err) {
                    console.error(err);
                    return res.send('Registration failed');
                }

                res.send('Registration successful');
            });
        });

    } catch (error) {
        console.error(error);
        res.send('Server error');
    }
});

module.exports = router;