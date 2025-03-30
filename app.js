// Load environment variables
require('dotenv').config();

// Imports...
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const exphbs = require('express-handlebars');
// ✅ Replaced connect-mongodb-session with connect-mongo
const MongoStore = require('connect-mongo');
const connectDB = require('./config/database');
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

// ✅ Session middleware — must be BEFORE any route that needs req.session
app.use(session({
  secret: 'forum-friends-secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: "mongodb+srv://aamosdelacruz:FDTZyf1Qdb5xGsxu@mco-ccapdev-forumfriend.aje9dcs.mongodb.net/?retryWrites=true&w=majority&appName=MCO-CCAPDEV-ForumFriends",
    dbName: 'forumdb'
  }),
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    secure: false
  }
}));

// Handlebars setup
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
    }
  }
}));
app.set('view engine', 'hbs');

// Start server after DB connection
connectDB().then((db) => {
  app.locals.db = db;
  console.log('Database connection stored in app.locals');

  // Modularized routes come AFTER session middleware is applied
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
