// server.js - Express entry point
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs-extra');

// Import routes
const authRoutes = require('./routes/auth');
const academicsRoutes = require('./routes/academics');
const lecturersRoutes = require('./routes/lecturers');
const studentsRoutes = require('./routes/students');
const marksRoutes = require('./routes/marks');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Create temp directory for file uploads
const tempDir = process.env.TEMP_FILE_DIR || '/tmp/ttu-uploads';
fs.ensureDirSync(tempDir);

// Security middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
    origin: ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/academics', academicsRoutes);
app.use('/api/lecturers', lecturersRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/marks', marksRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV 
    });
});

// Serve static frontend files (optional - if you want to serve frontend from backend)
app.use(express.static(path.join(__dirname, '../frontend')));

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 TTU Marks System Backend running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔧 Temp directory: ${tempDir}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    // Clean up temp files
    fs.emptyDirSync(tempDir);
    process.exit(0);
});

module.exports = app;