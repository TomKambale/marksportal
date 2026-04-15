const db = require('./db');
const bcrypt = require('bcrypt');

async function fixUserPassword() {
    const email = 'thomas.maghanga@ttu.ac.ke';
    const pfNumber = '12345';
    const correctPassword = 'hashedpassword';
    
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(correctPassword, saltRounds);
    
    console.log('New hash for Password:', hashedPassword);
    
    // Update the user's password
    const sql = `
        UPDATE users 
        SET password_hash = ? 
        WHERE email = ? AND pf_number = ?
    `;
    
    db.query(sql, [hashedPassword, email, pfNumber], (err, result) => {
        if (err) {
            console.error('Error updating password:', err);
        } else {
            console.log('Password updated successfully!');
            console.log('Rows affected:', result.affectedRows);
            
            if (result.affectedRows === 0) {
                console.log('User not found with those credentials');
            }
        }
        db.end(); // Close connection if needed
    });
}

fixUserPassword();