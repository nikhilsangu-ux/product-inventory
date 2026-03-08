const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcrypt");

const Product = require("./models/Product");
const User = require("./models/User");       // Merchant
const Customer = require("./models/Customer");
const Order = require("./models/Order");

const app = express();
app.use(cors());
app.use(express.json());

// Connect MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/product-inventory")
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

/* =================== MERCHANT APIs =================== */

// Register Merchant
app.post("/merchant/register", async (req, res) => {
    const { name, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hash });
    await user.save();
    res.json({ message: "Merchant registered successfully", user });
});

// Merchant Login
app.post("/merchant/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Invalid email" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid password" });
    res.json({ message: "Login successful", user });
});

// Add Product
app.post("/merchant/products", async (req, res) => {
    const product = new Product(req.body);
    await product.save();
    res.json({ message: "Product added successfully", product });
});

// Update Product
app.put("/merchant/products/:id", async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: "Product updated", product });
});

// Delete Product
app.delete("/merchant/products/:id", async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted" });
});

// Get all products (Merchant)
app.get("/merchant/products", async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

// View all orders (Merchant)
app.get("/merchant/orders", async (req, res) => {
    const orders = await Order.find()
        .populate("products.product")
        .populate("customer");
    res.json(orders);
});

// Update order status (Accept / Reject / Delivered)
app.put("/merchant/orders/:orderId/status", async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        if (!['Pending','Confirmed','Rejected','Delivered'].includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }

        const order = await Order.findById(orderId).populate("products.product");
        if (!order) return res.status(404).json({ error: "Order not found" });

        // If confirming, deduct stock
        if (status === 'Confirmed' && order.status === 'Pending') {
            for (let item of order.products) {
                if (!item.product) continue;
                if (item.product.stock < item.quantity) {
                    return res.status(400).json({ error: `Not enough stock for ${item.product.name}` });
                }
                item.product.stock -= item.quantity;
                await item.product.save();
            }
        }

        order.status = status;
        await order.save();
        res.json({ message: `Order status updated to ${status}`, order });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

/* =================== CUSTOMER APIs =================== */

// Customer Register
app.post("/customer/register", async (req, res) => {
    const { name, email, password, address } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const customer = new Customer({ name, email, password: hash, address });
    await customer.save();
    res.json({ message: "Customer registered successfully", customer });
});

// Customer Login
app.post("/customer/login", async (req, res) => {
    const { email, password } = req.body;
    const customer = await Customer.findOne({ email });
    if (!customer) return res.status(400).json({ error: "Invalid email" });
    const valid = await bcrypt.compare(password, customer.password);
    if (!valid) return res.status(400).json({ error: "Invalid password" });
    res.json({ message: "Login successful", customer });
});

// Get all products (Customer)
app.get("/products", async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

// Place Order
app.post("/orders", async (req, res) => {
    try {
        const { customerId, products } = req.body;
        if (!products || products.length === 0) 
            return res.status(400).json({ error: "Cart is empty" });

        let totalAmount = 0;

        // Compute total amount but do NOT deduct stock here
        for (let item of products) {
            const product = await Product.findById(item.product);
            if (!product) return res.status(400).json({ error: `Product with ID ${item.product} not found` });
            if (product.stock < item.quantity) 
                return res.status(400).json({ error: `Not enough stock for ${product.name}` });
            totalAmount += product.price * item.quantity;
        }

        const order = new Order({ customer: customerId, products, totalAmount, status: "Pending" });
        await order.save();
        res.json({ message: "Order placed successfully", order });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error" });
    }
});

// Get orders of a specific customer
app.get("/orders/:customerId", async (req, res) => {
    try {
        const orders = await Order.find({ customer: req.params.customerId })
            .populate("products.product")
            .populate("customer");
        res.json(orders);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));