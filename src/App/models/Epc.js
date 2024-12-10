const mongoose = require("mongoose");

const EpcSchema = new mongoose.Schema({
  epc: { type: String, required: true, unique: true },
  barcode: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  price: { type: Number, required: true },
  isCheckout: { type: Boolean, default: false },
});

module.exports = mongoose.model("Epc", EpcSchema);
