const mongoose = require("mongoose");

const customerSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    address: String
});

module.exports = mongoose.model("Customer", customerSchema);