const mongoose = require("mongoose");

async function connect() {
  const connectionParams = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };

  try {
    // Use the MONGO_URI environment variable from the .env file
    await mongoose.connect(
      "mongodb+srv://binhtayfood:binhtayfoodtool@binhtayfood.imdlw.mongodb.net/RFID_Checkout"
    );
    console.log("Database connected successfully");
  } catch (error) {
    console.log("Database connection error:", error);
  }
}

module.exports = { connect };
