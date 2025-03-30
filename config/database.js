// config/database.js
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://aamosdelacruz:FDTZyf1Qdb5xGsxu@mco-ccapdev-forumfriend.aje9dcs.mongodb.net/?retryWrites=true&w=majority&appName=MCO-CCAPDEV-ForumFriends";

const client = new MongoClient(uri); // ✅ clean constructor

async function connectToDatabase() {
  try {
    await client.connect();
    console.log("✅ Connected to MongoDB Atlas");
    return client.db("forumdb");
  } catch (err) {
    console.error("❌ Error connecting to MongoDB Atlas:", err);
    throw err;
  }
}

module.exports = connectToDatabase;
