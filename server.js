console.log("Server is starting...");

const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB Connection
mongoose
  .connect(
    "mongodb+srv://abhijeet:admin@cluster0.khqhv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}.jpg`);
  },
});
const upload = multer({ storage });

// MongoDB Schemas and Models
const productSchema = new mongoose.Schema({
  name: String,
  purchasePrice: String,
  retailPrice: String,
  wholesalePrice: String,
  image: String,
  barcode: String,
});

const settingSchema = new mongoose.Schema({
  codes: Object,
});

const Product = mongoose.model("Product", productSchema);
const Setting = mongoose.model("Setting", settingSchema);

/**
 * Helper Functions
 */
function encodePrice(price) {
  return price.split("").reverse().join("");
}

function generateBarcode(productId) {
  return `BARCODE-${productId}`;
}

/**
 * 1. Upload Product API
 */
app.post("/api/products", upload.single("productImage"), async (req, res) => {
  const { productName, purchasePrice, retailPrice, wholesalePrice } = req.body;
  console.log(req.file)
  if (!productName || !purchasePrice || !retailPrice || !wholesalePrice || !req.file) {
    return res.status(400).json({ error: "All fields and product image are required" });
  }

  try {
    const product = new Product({
      name: productName,
      purchasePrice,
      retailPrice: encodePrice(retailPrice),
      wholesalePrice: encodePrice(wholesalePrice),
      image: req.file.path.replace(/\\/g, "/"),
      barcode: generateBarcode(Date.now().toString()),
    });
    await product.save();
    res.status(201).json({ message: "Product saved successfully", product });
  } catch (error) {
    res.status(500).json({ error: "Failed to save product" });
  }
});

/**
 * 2. Update Product API
 */
app.put("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  const { productName, purchasePrice, retailPrice, wholesalePrice } = req.body;

  if (!productName || !purchasePrice || !retailPrice || !wholesalePrice) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { name: productName, purchasePrice, retailPrice, wholesalePrice },
      { new: true }
    );

    if (!updatedProduct) return res.status(404).json({ error: "Product not found" });

    res.status(200).json({ message: "Product updated successfully", updatedProduct });
  } catch (error) {
    res.status(500).json({ error: "Failed to update product" });
  }
});

/**
 * 3. Delete Product API
 */
app.delete("/api/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) return res.status(404).json({ error: "Product not found" });

    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

/**
 * 4. Get Product List API
 */
app.get("/api/products", async (req, res) => {
  try {
    const products = await Product.find();
    const productsWithImageUrl = products.map((product) => ({
      ...product._doc,
      image: `${product.image}`,
    }));
    console.log(productsWithImageUrl)
    res.status(200).json(productsWithImageUrl);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

/**
 * 5. Search Products API
 */
app.get("/api/products/search", async (req, res) => {
  const { query } = req.query;
  try {
    const filteredProducts = await Product.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { purchasePrice: { $regex: query, $options: "i" } },
      ],
    });
    res.status(200).json(filteredProducts);
  } catch (error) {
    res.status(500).json({ error: "Failed to search products" });
  }
});

/**
 * 6. Get Single Product by ID API
 */
app.get("/api/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    const productWithImageUrl = {
      ...product._doc,
      image: `${req.protocol}://${req.get("host")}/${product.image}`,
    };

    res.status(200).json(productWithImageUrl);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

/**
 * 7. Save Settings API
 */
app.post("/api/settings", async (req, res) => {
  const { codes } = req.body;
  if (!codes || typeof codes !== "object") {
    return res.status(400).json({ error: "Invalid settings format" });
  }

  try {
    await Setting.deleteMany();
    const setting = new Setting({ codes });
    await setting.save();
    res.status(200).json({ message: "Settings saved successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

/**
 * 8. Get Settings API
 */
app.get("/api/settings", async (req, res) => {
  try {
    const settings = await Setting.findOne();
    res.status(200).json(settings?.codes || {});
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

/**
 * 9. Delete Settings API
 */
app.delete("/api/settings/price-codes", async (req, res) => {
  try {
    await Setting.deleteMany();
    res.status(200).json({ message: "All price codes deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete price codes" });
  }
});

/**
 * 10. Image Upload API
 */
app.post("/api/images", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Image file is required" });
  }
  res.status(201).json({ imagePath: req.file.path.replace(/\\/g, '/') });
});

/**
 * 11. Serve Images API
 */
app.get("/api/images/:imageId", (req, res) => {
  const { imageId } = req.params;
  const filePath = path.join(__dirname, "uploads", imageId);
  res.sendFile(filePath);
});

/**
 * 12. Helper APIs for Switching Data Format (Alphabet/Number)
 */
app.post("/api/switch-to-alphabet", (req, res) => {
  const { price } = req.body;
  if (!price) return res.status(400).json({ error: "Price is required" });

  const alphabetPrice = price
    .toString()
    .split("")
    .map((char) => String.fromCharCode(97 + parseInt(char, 10)))
    .join("");
  res.status(200).json({ alphabetPrice });
});

app.post("/api/switch-to-number", (req, res) => {
  const { alphabetPrice } = req.body;
  if (!alphabetPrice) return res.status(400).json({ error: "Alphabet price is required" });

  const numberPrice = alphabetPrice
    .split("")
    .map((char) => (char.charCodeAt(0) - 97).toString())
    .join("");
  res.status(200).json({ numberPrice });
});

/**
 * Start Server
 */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
