const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://wafts2883:atoel1808@cluster0.q5nktzs.mongodb.net/';

let client;

async function connectToMongoDB() {
  try {
    client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    console.log('Connected to MongoDB Atlas');
  } catch (error) {
    console.error('Error connecting to MongoDB Atlas:', error);
  }
}

function getClient() {
  return client;
}

module.exports = {
  connectToMongoDB,
  getClient
};
