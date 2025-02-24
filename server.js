const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const cloudinary = require('cloudinary').v2; // Import Cloudinary
const { CloudinaryStorage } = require('multer-storage-cloudinary'); // For Cloudinary storage
const path = require('path'); // Import the path module
require('dotenv').config(); // Load environment variables

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch(err => {
    console.error('MongoDB Atlas connection error:', err);
    process.exit(1); // Exit the process if MongoDB connection fails
  });

// Multer Configuration for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: (req) => req.body.page, // Organize images by page
    format: async (req, file) => 'png', // Supports other formats like jpeg, webp, etc.
    public_id: (req, file) => `${Date.now()}-${file.originalname}`, // Unique filename
  },
});

const upload = multer({ storage });

// Product Schema and Model
const productSchema = new mongoose.Schema({
  name: String,
  filename: String, // This will store the Cloudinary URL
  page: String,
  description: String,
  category: String,
});

const Product = mongoose.model('Product', productSchema);

// Add Product Route (with Cloudinary upload)
app.post('/add-product', upload.single('image'), async (req, res) => {
  try {
    const { name, page, description, category } = req.body;
    if (!name || !page || !req.file || !category) {
      console.error('Validation error: Name, page, category, and image are required');
      return res.status(400).json({ error: 'Name, page, category, and image are required' });
    }

    // Save product to MongoDB
    const newProduct = new Product({
      name,
      filename: req.file.path, // Store Cloudinary URL
      page,
      description,
      category,
    });
    await newProduct.save();

    console.log('Product added successfully:', newProduct);
    res.status(201).json({ message: 'Product added successfully', product: newProduct });
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// Remove Single Product Route
app.delete('/remove-product/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.error('Product not found with ID:', req.params.id);
      return res.status(404).json({ error: 'Product not found' });
    }

    // Delete image from Cloudinary
    const publicId = product.filename.split('/').pop().split('.')[0]; // Extract public ID from URL
    await cloudinary.uploader.destroy(publicId);

    // Delete product from MongoDB
    await Product.findByIdAndDelete(req.params.id);

    console.log('Product removed successfully:', req.params.id);
    res.status(200).json({ message: 'Product removed successfully' });
  } catch (err) {
    console.error('Error removing product:', err);
    res.status(500).json({ error: 'Failed to remove product' });
  }
});

// Update Product Route
app.put('/update-product/:id', upload.single('image'), async (req, res) => {
  try {
    const { name, page, description, category } = req.body;
    const productId = req.params.id;

    // Find the existing product
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      console.error('Product not found with ID:', productId);
      return res.status(404).json({ error: 'Product not found' });
    }

    // Prepare the update data
    const updateData = { name, page, description, category };

    // If a new image is uploaded, update the filename and delete the old image
    if (req.file) {
      // Delete the old image from Cloudinary
      const oldPublicId = existingProduct.filename.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(oldPublicId);

      // Update the filename with the new Cloudinary URL
      updateData.filename = req.file.path;
    }

    // Update the product in the database
    const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, { new: true });

    console.log('Product updated successfully:', updatedProduct);
    res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Remove All Products Route
app.delete('/remove-all-products', async (req, res) => {
  try {
    const products = await Product.find();
    if (products.length === 0) {
      console.error('No products found to delete');
      return res.status(404).json({ error: 'No products found to delete' });
    }

    // Delete all images from Cloudinary
    for (const product of products) {
      const publicId = product.filename.split('/').pop().split('.')[0];
      await cloudinary.uploader.destroy(publicId);
    }

    // Delete all products from MongoDB
    await Product.deleteMany({});

    console.log('All products removed successfully');
    res.status(200).json({ message: 'All products removed successfully' });
  } catch (err) {
    console.error('Error removing all products:', err);
    res.status(500).json({ error: 'Failed to remove all products' });
  }
});

// Get All Products Route
app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    console.log('Products fetched successfully:', products);
    res.status(200).json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Get Single Product by ID Route
app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      console.error('Product not found with ID:', req.params.id);
      return res.status(404).json({ error: 'Product not found' });
    }
    console.log('Product fetched successfully:', product);
    res.status(200).json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));