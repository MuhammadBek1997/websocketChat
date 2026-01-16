const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Agar allaqachon ulangan bo'lsa, qayta ulanmaslik
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB allaqachon ulangan');
      return mongoose.connection;
    }

    // Agar ulanish jarayonida bo'lsa, kutish
    if (mongoose.connection.readyState === 2) {
      console.log('MongoDB ulanish jarayonida...');
      await new Promise(resolve => {
        mongoose.connection.once('connected', resolve);
      });
      return mongoose.connection;
    }

    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.warn('MONGODB_URI topilmadi. DB ulanishi o\'tkazib yuboriladi.');
      return null;
    }
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB ulandi: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB ulanish xatosi: ${error.message}`);
    // Serverless muhitda process.exit() funksiyani yiqitadi. Shunchaki qayd etamiz.
    throw error; // Xatoni yuqoriga uzatish
  }
};

module.exports = connectDB;
