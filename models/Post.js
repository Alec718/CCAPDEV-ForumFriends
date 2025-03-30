// models/Post.js
const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    title: { type: String, required: true },
    content: { type: String, required: true },
    author: { type: String, required: true },
    tags: [String],
    category: { type: String, default: 'General' },
    votes: { type: Number, default: 0 },
    comments: { type: Array, default: [] },
    voters: { type: Map, of: String, default: {} },  // Fix: Properly define voters as a Map
    createdAt: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);
module.exports = Post;

