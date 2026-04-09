const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Secret key for JWT (in production, use environment variable)
const JWT_SECRET = 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = 'your-refresh-secret-key-change-in-production';

// Mock database (in production, use real database like MySQL, PostgreSQL, etc.)
const mockDatabase = {
    // Lecturers data
    lecturers: [
        {
            email_address: "john.doe@ttu.ac.ke",
            pf_no: "TTU241",
            full_name: "Dr. John Doe",
            password: bcrypt.hashSync("rt0[([etx7gvOnSOx4@[CzaAmS][%{", 10), // Hashed password
            username: "hostel-checker"
        },
        {
            email_address: "jane.smith@ttu.ac.ke",
            pf_no: "TTU242",
            full_name: "Prof. Jane Smith",
            password: bcrypt.hashSync("password123", 10),
            username: "jane.smith"
        }
    ],
    
    // Semesters data
    semesters: [
        { semester: "Sem 1 24/25", status: "open" },
        { semester: "Sem 2 25/26", status: "open" },
        { semester: "Sem 1 25/26", status: "closed" }
    ],
    
    // Classes data
    classes: [
        {
            semester: "Sem 1 25/26",
            pf_no: "TTU241",
            program_code: "BSCS",
            program_name: "Bachelor of Computer Science",
            stage: "Y3S1",
            unit_code: "SCI2302",
            unit_name: "Data Structures and Algorithms",
            exam_category: "degree"
        },
        {
            semester: "Sem 1 25/26",
            pf_no: "TTU241",
            program_code: "BSCS",
            program_name: "Bachelor of Computer Science",
            stage: "Y2S2",
            unit_code: "SCS2312",
            unit_name: "Object-Oriented Programming",
            exam_category: "degree"
        },
        {
            semester: "Sem 1 25/26",
            pf_no: "TTU241",
            program_code: "BIT",
            program_name: "Bachelor of Information Technology",
            stage: "Y3S1",
            unit_code: "SIC2305",
            unit_name: "Database Systems",
            exam_category: "degree"
        }
    ],
    
    // Student marks data
    studentMarks: [
        {
            program_code: "BIT",
            stage: "Y3S2",
            unit_code: "SCI2302",
            students: [
                { student_no: "SCT221-0012/2022", student_name: "Alice Wanjiku", cat_marks: 28.5, final_exam_marks: 65.0 },
                { student_no: "SCT221-0045/2022", student_name: "Brian Otieno", cat_marks: 24.0, final_exam_marks: 58.5 },
                { student_no: "SCT221-0089/2022", student_name: "Carol Jepchumba", cat_marks: 19.0, final_exam_marks: 51.0 }
            ]
        },
        {
            program_code: "BSCS",
            stage: "Y3S1",
            unit_code: "SCI2302",
            students: [
                { student_no: "SCT221-0100/2022", student_name: "David Kimathi", cat_marks: 30.0, final_exam_marks: 72.5 },
                { student_no: "SCT221-0111/2022", student_name: "Eunice Mwangi", cat_marks: 27.5, final_exam_marks: 68.0 }
            ]
        }
    ],
    
    // Refresh tokens (in production, store in database)
    refreshTokens: []
};

// Helper function to generate tokens
function generateTokens(user) {
    const accessToken = jwt.sign(
        { 
            email: user.email_address, 
            pf_no: user.pf_no,
            username: user.username 
        }, 
        JWT_SECRET, 
        { expiresIn: '1h' }
    );
    
    const refreshToken = jwt.sign(
        { email: user.email_address, pf_no: user.pf_no },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
    
    return { access: accessToken, refresh: refreshToken };
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ==================== API ENDPOINTS ====================

// Token endpoint (for authentication)
app.post('/api/token/', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }
        
        // Find user by username
        const user = mockDatabase.lecturers.find(l => l.username === username);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate tokens
        const tokens = generateTokens(user);
        
        // Store refresh token
        mockDatabase.refreshTokens.push({
            token: tokens.refresh,
            email: user.email_address
        });
        
        res.status(200).json(tokens);
        
    } catch (error) {
        console.error('Token generation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Refresh token endpoint
app.post('/api/token/refresh/', (req, res) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
        return res.status(400).json({ error: 'Refresh token required' });
    }
    
    // Check if refresh token exists in store
    const storedToken = mockDatabase.refreshTokens.find(t => t.token === refresh_token);
    if (!storedToken) {
        return res.status(403).json({ error: 'Invalid refresh token' });
    }
    
    // Verify refresh token
    jwt.verify(refresh_token, JWT_REFRESH_SECRET, (err, userData) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired refresh token' });
        }
        
        // Find user
        const user = mockDatabase.lecturers.find(l => l.email_address === userData.email);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Generate new tokens
        const tokens = generateTokens(user);
        
        // Update refresh token in store
        const index = mockDatabase.refreshTokens.findIndex(t => t.token === refresh_token);
        if (index !== -1) {
            mockDatabase.refreshTokens[index] = {
                token: tokens.refresh,
                email: user.email_address
            };
        }
        
        res.status(200).json(tokens);
    });
});

// Stage 1: Get User Details (No authentication required)
app.get('/api/exam/v1/lecturer/details', (req, res) => {
    try {
        const { email_address, pf_no } = req.body;
        
        if (!email_address || !pf_no) {
            return res.status(400).json({ error: 'Missing required fields: email_address and pf_no' });
        }
        
        const lecturer = mockDatabase.lecturers.find(
            l => l.email_address === email_address && l.pf_no === pf_no
        );
        
        if (!lecturer) {
            return res.status(404).json({ error: 'Lecturer not found' });
        }
        
        res.status(200).json({
            email_address: lecturer.email_address,
            pf_no: lecturer.pf_no,
            full_name: lecturer.full_name
        });
        
    } catch (error) {
        console.error('Error fetching lecturer details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stage 2: Get Semesters Taught (Requires authentication)
app.get('/api/exam/v1/lecturer/semesters', authenticateToken, (req, res) => {
    try {
        const { email_address, pf_no } = req.body;
        
        if (!email_address || !pf_no) {
            return res.status(400).json({ error: 'Missing required fields: email_address and pf_no' });
        }
        
        // Verify that the authenticated user matches the request
        if (req.user.email !== email_address && req.user.pf_no !== pf_no) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Return semesters (in production, filter by lecturer)
        res.status(200).json(mockDatabase.semesters);
        
    } catch (error) {
        console.error('Error fetching semesters:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stage 3: Get Classes for Semester (Requires authentication)
app.get('/api/exam/v1/lecturer/classes', authenticateToken, (req, res) => {
    try {
        const { semester, pf_no } = req.body;
        
        if (!semester || !pf_no) {
            return res.status(400).json({ error: 'Missing required fields: semester and pf_no' });
        }
        
        // Verify that the authenticated user matches the request
        if (req.user.pf_no !== pf_no) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const classes = mockDatabase.classes.filter(
            c => c.semester === semester && c.pf_no === pf_no
        );
        
        if (classes.length === 0) {
            return res.status(404).json({ error: 'No classes found for the specified semester' });
        }
        
        res.status(200).json(classes);
        
    } catch (error) {
        console.error('Error fetching classes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stage 4: Get Student Marks (Requires authentication)
app.get('/api/exam/v1/lecturer/class-list', authenticateToken, (req, res) => {
    try {
        const { program_code, stage, unit_code } = req.body;
        
        if (!program_code || !stage || !unit_code) {
            return res.status(400).json({ error: 'Missing required fields: program_code, stage, and unit_code' });
        }
        
        const classData = mockDatabase.studentMarks.find(
            c => c.program_code === program_code && 
                 c.stage === stage && 
                 c.unit_code === unit_code
        );
        
        if (!classData || !classData.students || classData.students.length === 0) {
            return res.status(404).json({ error: 'No students found for the specified class' });
        }
        
        res.status(200).json(classData.students);
        
    } catch (error) {
        console.error('Error fetching student marks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Optional: POST endpoint for updating marks (with authentication)
app.post('/api/exam/v1/lecturer/update-marks', authenticateToken, (req, res) => {
    try {
        const { program_code, stage, unit_code, student_marks } = req.body;
        
        if (!program_code || !stage || !unit_code || !student_marks) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        const classIndex = mockDatabase.studentMarks.findIndex(
            c => c.program_code === program_code && 
                 c.stage === stage && 
                 c.unit_code === unit_code
        );
        
        if (classIndex === -1) {
            return res.status(404).json({ error: 'Class not found' });
        }
        
        // Update student marks
        student_marks.forEach(updatedStudent => {
            const studentIndex = mockDatabase.studentMarks[classIndex].students.findIndex(
                s => s.student_no === updatedStudent.student_no
            );
            
            if (studentIndex !== -1) {
                if (updatedStudent.cat_marks !== undefined) {
                    mockDatabase.studentMarks[classIndex].students[studentIndex].cat_marks = updatedStudent.cat_marks;
                }
                if (updatedStudent.final_exam_marks !== undefined) {
                    mockDatabase.studentMarks[classIndex].students[studentIndex].final_exam_marks = updatedStudent.final_exam_marks;
                }
            }
        });
        
        res.status(200).json({ message: 'Marks updated successfully' });
        
    } catch (error) {
        console.error('Error updating marks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Logout endpoint (invalidate refresh token)
app.post('/api/logout/', authenticateToken, (req, res) => {
    const { refresh_token } = req.body;
    
    if (refresh_token) {
        const index = mockDatabase.refreshTokens.findIndex(t => t.token === refresh_token);
        if (index !== -1) {
            mockDatabase.refreshTokens.splice(index, 1);
        }
    }
    
    res.status(200).json({ message: 'Logged out successfully' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API Base URL: http://localhost:${PORT}/api/exam/v1`);
    console.log(`Token endpoint: http://localhost:${PORT}/api/token/`);
});

module.exports = app;