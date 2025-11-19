const express = require('express');
const session = require('express-session');
const MemoryStore = require('memorystore')(session);
const cors = require('cors');
const mysql = require('mysql2');

const app = express();
const PORT = 3000;

// MySQL Database Connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',           // Change to your MySQL username
  password: 'mirko062698',           // Change to your MySQL password
  database: 'student_management'
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    console.log('\n⚠️  Please check:');
    console.log('   1. MySQL is running');
    console.log('   2. Database "student_management" exists');
    console.log('   3. Username and password are correct\n');
    process.exit(1);
  } else {
    console.log('✅ Connected to MySQL database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  // Users table
  db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(50) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL
    )
  `, (err) => {
    if (err) console.error('Error creating users table:', err);
  });

  // Students table
  db.query(`
    CREATE TABLE IF NOT EXISTS students (
      student_id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      attendance ENUM('present', 'absent') DEFAULT 'present',
      user_id INT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.error('Error creating students table:', err);
  });

  // Create default users
  db.query(`
    INSERT IGNORE INTO users (username, password) 
    VALUES ('admin', 'admin'), ('mirko', '1234'), ('angelo', '1234')
  `, (err) => {
    if (err) console.error('Error creating default users:', err);
    else console.log('✅ Default users ready (admin/admin, mirko/1234, angelo/1234)');
  });
}

// Middleware - ORDER MATTERS!
app.use(express.json());

app.use(cors({
  origin: ['http://127.0.0.1:5500', 'http://localhost:5500', 'http://127.0.0.1:8080', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(session({
  cookie: { 
    maxAge: 86400000,
    secure: false,
    httpOnly: false,
    sameSite: 'lax'
  },
  store: new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  secret: 'keyboard-cat-secret-key-change-this',
  resave: false,
  saveUninitialized: false
}));

// Authentication middleware
function requireAuth(req, res, next) {
  console.log('🔍 Session check:', {
    sessionID: req.sessionID,
    userId: req.session.userId,
    username: req.session.username
  });
  
  if (!req.session.userId) {
    console.log('❌ Not authenticated');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log('✅ Authenticated as:', req.session.username);
  next();
}

// ============================================
// Authentication Routes
// ============================================

// Check authentication status
app.get('/api/auth/check', (req, res) => {
  if (req.session.userId) {
    res.json({ 
      authenticated: true, 
      username: req.session.username 
    });
  } else {
    res.json({ authenticated: false });
  }
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  console.log('🔐 Login attempt:', username);

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.query(
    'SELECT * FROM users WHERE username = ? AND password = ?',
    [username, password],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (results.length === 0) {
        console.log('❌ Invalid credentials for:', username);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = results[0];
      req.session.userId = user.id;
      req.session.username = user.username;

      console.log('✅ Login successful:', {
        userId: user.id,
        username: user.username,
        sessionID: req.sessionID
      });

      res.json({ 
        success: true, 
        user: { 
          id: user.id, 
          username: user.username 
        } 
      });
    }
  );
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// ============================================
// Student Routes
// ============================================

// Get all students
app.get('/api/students', requireAuth, (req, res) => {
  db.query(
    'SELECT student_id, name, attendance FROM students WHERE user_id = ?',
    [req.session.userId],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results);
    }
  );
});

// Add student
app.post('/api/students', requireAuth, (req, res) => {
  const { id, name, attendance } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: 'ID and name are required' });
  }

  db.query(
    'INSERT INTO students (student_id, name, attendance, user_id) VALUES (?, ?, ?, ?)',
    [id, name, attendance || 'present', req.session.userId],
    (err) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Student ID already exists' });
        }
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({ 
        success: true, 
        student: { student_id: id, name, attendance: attendance || 'present' } 
      });
    }
  );
});

// Update student
app.put('/api/students/:id', requireAuth, (req, res) => {
  const { id: oldId } = req.params;
  const { id: newId, name, attendance } = req.body;

  if (!newId || !name) {
    return res.status(400).json({ error: 'ID and name are required' });
  }

  db.query(
    'UPDATE students SET student_id = ?, name = ?, attendance = ? WHERE student_id = ? AND user_id = ?',
    [newId, name, attendance || 'present', oldId, req.session.userId],
    (err, result) => {
      if (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ error: 'Student ID already exists' });
        }
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      res.json({ success: true });
    }
  );
});

// Update attendance
app.patch('/api/students/:id/attendance', requireAuth, (req, res) => {
  const { id } = req.params;
  const { attendance } = req.body;

  if (!['present', 'absent'].includes(attendance)) {
    return res.status(400).json({ error: 'Invalid attendance value' });
  }

  db.query(
    'UPDATE students SET attendance = ? WHERE student_id = ? AND user_id = ?',
    [attendance, id, req.session.userId],
    (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      res.json({ success: true });
    }
  );
});

// Delete student
app.delete('/api/students/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  db.query(
    'DELETE FROM students WHERE student_id = ? AND user_id = ?',
    [id, req.session.userId],
    (err, result) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Student not found' });
      }

      res.json({ success: true });
    }
  );
});

// Get statistics
app.get('/api/statistics', requireAuth, (req, res) => {
  db.query(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN attendance = 'present' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN attendance = 'absent' THEN 1 ELSE 0 END) as absent
    FROM students 
    WHERE user_id = ?`,
    [req.session.userId],
    (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(results[0]);
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log('📝 Default login credentials:');
  console.log('   - admin / admin');
  console.log('   - mirko / 1234');
  console.log('   - angelo / 1234\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.end((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed');
    }
    process.exit(0);
  });
});