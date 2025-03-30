// models/Comment.js
const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    author: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    votes: { type: Number, default: 0 },
    voters: { type: Map, of: String, default: {} }, // <-- updated
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, default: null },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true }
});

module.exports = mongoose.model('Comment', commentSchema);

