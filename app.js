// Load environment variables
require('dotenv').config();

// Imports...
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const exphbs = require('express-handlebars');
const MongoStore = require('connect-mongo');
const { MongoClient } = require('mongodb');
const methodOverride = require('method-override');
const moment = require('moment');

// Initialize app
const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(methodOverride('_method'));

// Use MongoDB URI from environment variables
const uri = process.env.MONGODB_URI;

// Initialize MongoClient
const client = new MongoClient(uri, {
  serverApi: { version: '1' }
});

// Session middleware — must be BEFORE any route that uses req.session
app.use(session({
  secret: 'forum-friends-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: uri,
    dbName: 'forumdb'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // only true on Render
    sameSite: 'lax'
  }
}));

// Handlebars setup with extra helpers
app.engine('hbs', exphbs.engine({
  extname: '.hbs',
  defaultLayout: 'main',
  partialsDir: path.join(__dirname, 'views', 'partials'),
  helpers: {
    concat: function () {
      return Array.prototype.slice.call(arguments, 0, -1).join('');
    },
    eq: function (a, b) {
      return a === b;
    },
    formatDate: function (timestamp) {
      return new Date(timestamp).toLocaleString();
    },
    strlen: function (text) {
      return (text || '').length;
    },
    gt: function (a, b) {
      return a > b;
    },
    trimContent: function (text, length) {
      if (!text) return '';
      return text.substring(0, length);
    }
  }
}));
app.set('view engine', 'hbs');

// Database connect function
async function connectDB() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");
    const db = client.db(); // uses default DB in URI
    return db;
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    throw err;
  }
}

// Start server after DB connection
connectDB().then((db) => {
  app.locals.db = db;
  console.log('Database connection stored in app.locals');

  // Modularized routes
  const rootRoutes = require('./routes/rootRoutes');
  const userRoutes = require('./routes/userRoutes');
  const postRoutes = require('./routes/postRoutes');
  const commentRoutes = require('./routes/commentRoutes');

  app.use('/', rootRoutes);
  app.use('/', userRoutes);
  app.use('/', postRoutes);
  app.use('/', commentRoutes);

  const PORT = process.env.PORT || 9090;
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}).catch((err) => {
  console.error('Database connection failed:', err);
  process.exit(1);
});

module.exports = app;
