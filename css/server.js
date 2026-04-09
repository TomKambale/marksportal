const express = require('express');
const path = require('path');

const app = express();
app.get('/test', (req, res) => {
  console.log('TEST ROUTE HIT');
  res.send('Route works');
});

// Parse URL-encoded POST data
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // optional if you send JSON

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/', require('../Backend/routes/register'));
app.use('/', require('../Backend/routes/login'));

// Start server
app.listen(3000, () => console.log('Server running on http://localhost:3000'));