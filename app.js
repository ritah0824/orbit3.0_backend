require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CORS Configuration with environment variables
const allowedOrigins = process.env. ALLOWED_ORIGINS 
    ? process.env. ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3001', 'http://localhost:5173'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log(`❌ CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders:  ['Content-Type', 'Authorization']
}));

// ============================================
// DATABASE CONNECTION
// ============================================

mongoose.set('strictQuery', false);

const MONGODB_URI = process.env. MONGODB_URI || 'mongodb://localhost:27017/time_db';

console.log('🚀 Starting Orbit Pomodoro API...');
console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🌐 Allowed Origins: ${allowedOrigins.join(', ')}`);

mongoose.connect(MONGODB_URI, {
    useNewUrlParser:  true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ MongoDB connected successfully');
}).catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// ============================================
// SCHEMAS & MODELS
// ============================================

const taskSchema = new mongoose.Schema({
    name: { type: String, required: true },
    num:  { type: Number, default: 1 },
    finish: { type: Number, default: 0 },
    user: { type: String, required: true },
    day: Number
}, { timestamps: true });

const userSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        minlength: 3
    },
    password: { 
        type: String, 
        required: true,
        minlength: 6
    }
}, { timestamps: true });

const recordSchema = new mongoose.Schema({
    user: { type: String, required:  true }
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);
const User = mongoose. model('User', userSchema);
const Record = mongoose.model('Record', recordSchema);

// ============================================
// MIDDLEWARE - AUTHENTICATION
// ============================================

const requireAuth = async (req, res, next) => {
    try {
        if (!req.cookies.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }
        
        req.userId = req.cookies.user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({
            success: false,
            error: 'Authentication failed'
        });
    }
};

// ============================================
// ROUTES - HEALTH CHECK
// ============================================

app.get('/', (req, res) => {
    res.json({
        status: '🪐 Orbit Pomodoro API is running!',
        version: '3.0.0',
        timestamp: new Date(),
        environment: process.env. NODE_ENV || 'development'
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        uptime:  process.uptime()
    });
});

// ============================================
// ROUTES - AUTHENTICATION
// ============================================

// LOGIN
app.post('/login', async (req, res) => {
    try {
        const { name, password } = req. body;

        if (!name || !password) {
            return res.status(400).json({
                success: false,
                error: 'Name and password are required'
            });
        }

        const user = await User.findOne({ name });
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const isMatch = await bcrypt. compare(password, user.password);
        
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const expires = new Date();
        expires.setHours(expires.getHours() + 24);
        
        res.cookie('user', user._id. toString(), {
            expires: expires,
            httpOnly: true,
            secure: process. env.NODE_ENV === 'production',
            sameSite:  process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });

        console.log(`✅ User logged in: ${user.name}`);

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user. name
            }
        });
    } catch (error) {
        console.error('Error login:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});

// SIGNUP
app.post('/signup', async (req, res) => {
    try {
        const { name, password } = req.body;

        if (!name || !password) {
            return res.status(400).json({
                success: false,
                error: 'Name and password are required'
            });
        }

        if (name.length < 3) {
            return res.status(400).json({
                success: false,
                error: 'Name must be at least 3 characters'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }

        const existingUser = await User.findOne({ name });
        
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'User already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new User({
            name,
            password: hashedPassword
        });

        await user.save();

        const expires = new Date();
        expires.setHours(expires.getHours() + 24);
        
        res.cookie('user', user._id.toString(), {
            expires: expires,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ?  'none' : 'lax'
        });

        console.log(`✅ New user created: ${user.name}`);

        res.status(201).json({
            success: true,
            user: {
                id: user._id,
                name: user.name
            }
        });
    } catch (error) {
        console.error('Error signup:', error);
        res.status(500).json({
            success: false,
            error: 'Signup failed'
        });
    }
});

// LOGOUT
app.post('/logout', (req, res) => {
    try {
        res.clearCookie('user');
        console.log('✅ User logged out');
        res.json({
            success: true
        });
    } catch (error) {
        console.error('Error logout:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

// CHECK AUTH STATUS
app.get('/auth/status', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req. userId).select('-password');
        res.json({
            success: true,
            authenticated: true,
            user: user ?  {
                id: user._id,
                name: user.name
            } : null
        });
    } catch (error) {
        res.json({
            success: true,
            authenticated: false
        });
    }
});

// ============================================
// ROUTES - TASKS
// ============================================

// GET ALL TASKS
app.get('/getTasks', requireAuth, async (req, res) => {
    try {
        const tasks = await Task.find({
            user: req.userId
        }).sort({ createdAt: 1 });
        
        res.json({
            success: true,
            data: tasks
        });
    } catch (error) {
        console.error('Error getting tasks:', error);
        res.status(500).json({
            success: false,
            error:  'Failed to get tasks'
        });
    }
});

// ADD TASK
app.post('/addTask', requireAuth, async (req, res) => {
    try {
        const { name, num } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Task name is required'
            });
        }

        const task = new Task({
            name: name.trim(),
            num: parseInt(num) || 1,
            finish: 0,
            user:  req.userId
        });

        await task.save();

        const tasks = await Task.find({
            user: req.userId
        }).sort({ createdAt: 1 });

        console.log(`✅ Task created: ${task.name}`);

        res.status(201).json({
            success: true,
            data: tasks
        });
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add task'
        });
    }
});

// UPDATE TASK
app.patch('/updateTask/:id', requireAuth, async (req, res) => {
    try {
        const { finish } = req.body;
        const { id } = req.params;

        if (finish === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Finish value is required'
            });
        }

        const task = await Task.findOne({
            _id: id,
            user: req.userId
        });

        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }

        task.finish = parseInt(finish);
        await task. save();

        const tasks = await Task.find({
            user: req.userId
        }).sort({ createdAt: 1 });

        console.log(`✅ Task updated: ${task.name}`);

        res.json({
            success: true,
            data: tasks
        });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update task'
        });
    }
});

// DELETE TASK
app.delete('/deleteTask/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await Task.findOneAndDelete({
            _id: id,
            user: req.userId
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }

        const tasks = await Task.find({
            user: req.userId
        }).sort({ createdAt: 1 });

        console.log(`✅ Task deleted: ${result.name}`);

        res.json({
            success: true,
            data: tasks
        });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete task'
        });
    }
});

// DELETE ALL TASKS
app.delete('/deleteAll', requireAuth, async (req, res) => {
    try {
        await Task.deleteMany({
            user: req.userId
        });

        console.log(`✅ All tasks deleted for user`);

        res.json({
            success: true,
            data: []
        });
    } catch (error) {
        console.error('Error deleting all tasks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete all tasks'
        });
    }
});

// ============================================
// ROUTES - RECORDS
// ============================================

// ADD RECORD
app.post('/recordAdd', requireAuth, async (req, res) => {
    try {
        const record = new Record({
            user:  req.userId
        });
        
        await record.save();

        console.log(`✅ Pomodoro record added`);

        res.status(201).json({
            success: true
        });
    } catch (error) {
        console.error('Error recordAdd:', error);
        res.status(500).json({
            success: false,
            error:  'Failed to add record'
        });
    }
});

// GET REPORT
app.get('/report', requireAuth, async (req, res) => {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo. setDate(oneWeekAgo.getDate() - 7);

        const reportData = await Record.aggregate([
            {
                $match: {
                    user: req.userId,
                    createdAt: { $gte: oneWeekAgo }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$createdAt'
                        }
                    },
                    recordCount: { $sum: 1 }
                }
            },
            {
                $sort:  { _id: 1 }
            }
        ]);

        const days = generateDateRange(7);
        const results = days.map(date => {
            const record = reportData.find(r => r._id === date);
            return {
                date: date,
                recordCount: record ? record.recordCount : 0
            };
        });

        res.json({ 
            success: true, 
            data: results 
        });
    } catch (error) {
        console.error('Error getting report:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get report'
        });
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateDateRange(days = 7) {
    const dates = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        dates.push(date. toISOString().split('T')[0]);
    }
    return dates;
}

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    res.status(err.status || 500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Ready to accept requests from:  ${allowedOrigins.join(', ')}`);
});

process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, closing server gracefully...');
    mongoose.connection.close();
    process.exit(0);
});
