const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn('MONGODB_URI topilmadi. DB ulanishi o‘tkazib yuboriladi.');
      return null;
    }
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB ulandi: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB ulanish xatosi: ${error.message}`);
    // Serverless muhitda process.exit() funksiyani yiqitadi. Shunchaki qayd etamiz.
    return null;
  }
};

module.exports = connectDB;
