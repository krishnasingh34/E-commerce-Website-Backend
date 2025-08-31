const port = process.env.PORT || 4000;
const express = require('express')
const app = express()
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path')
const cors = require('cors');

dotenv.config();

app.use(express.json())
app.use(cors())

// Database connection with MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

//API creation
app.get('/', (req, res) => {
    res.send('Express app is running')
})

// Image storage engine
const storage = multer.diskStorage({
    destination: './upload/images',
    filename: (req, file, cb) => {
        return cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})

const upload = multer({ storage: storage })

// Creating endpoint for uploading images
app.use('/images', express.static('upload/images'))

app.post('/upload', upload.single('product'), (req, res) => {
    res.json({
        success: 1,
        image_url: `http://localhost:${port}/images/${req.file.filename}`
    })
})

// Schema for creating products
const Product = mongoose.model('Product', {
    id: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    new_price: {
        type: Number,
        required: true,
    },
    old_price: {
        type: Number,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now,
    },
    available: {
        type: Boolean,
        default: true,
    },
})

// Creating endpoint for adding product
app.post('/addproduct', async (req, res) => {
    let products = await Product.find({})
    let id
    if (products.length > 0) {
        let last_product_array = products.slice(-1)
        let last_product = last_product_array[0]
        id = last_product.id + 1
    }
    else {
        id = 1
    }
    const product = new Product({
        id: id,
        name: req.body.name,
        image: req.body.image,
        category: req.body.category,
        new_price: req.body.new_price,
        old_price: req.body.old_price,
    })
    console.log(product)
    await product.save()
    console.log('Saved')
    res.json({
        success: true,
        name: req.body.name,
    })
})

// Creating endpoint for removing product
app.post('/removeproduct', async (req, res) => {
    await Product.findOneAndDelete({ id: req.body.id })
    console.log('Removed')
    res.json({
        success: true,
        name: req.body.name
    })
})

// Creating endpoint for getting all products
app.get('/allproducts', async (req, res) => {
    let products = await Product.find({})
    console.log('All products fetched')
    res.send(products)
})

// Schema for creating user model
const Users = mongoose.model('Users', {
    name: {
        type: String
    },
    email: {
        type: String,
        unique: true
    },
    password: {
        type: String
    },
    cartData: {
        type: Object,
    },
    date: {
        type: Date,
        default: Date.now
    }
})

// Creating endpoint for registering the user
app.post('/signup', async (req, res) => {
    let check = await Users.findOne({ email: req.body.email })
    if (check) {
        return res.status(400).json({
            success: false,
            message: "User already exists with that email", data: null
        })
    }
    let cart = {}
    for (let i = 0; i < 300; i++) {
        cart[i] = 0
    }

    const user = new Users({
        name: req.body.username,
        email: req.body.email,
        password: req.body.password,
        cartData: cart,
    })
    await user.save()
    const data = {
        user: {
            id: user.id
        }
    }
    const token = jwt.sign(data, process.env.JWT_SECRET)
    res.json({
        success: true,
        message: 'User saved successfully',
        data: {
            name: req.body.username,
            email: req.body.email,
            token: token
        }
    })
})

// Creating endpoint for logging the user
app.post('/login', async (req, res) => {
    try {
        let user = await Users.findOne({ email: req.body.email })
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                data: null
            })
        }

        const passCompare = req.body.password === user.password
        if (!passCompare) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password',
                data: null
            })
        }

        const data = {
            user: {
                id: user.id
            }
        }
        const token = jwt.sign(data, process.env.JWT_SECRET)
        res.status(200).json({
            success: true,
            message: 'User logged in successfully',
            data: {
                name: user.name,
                email: user.email,
                token: token
            }
        })
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            data: null
        })
    }
})

// Creating middleware to fetch user
const fetchUser = async (req, res, next) => {
    const token = req.header('auth-token')
    if (!token) {
        res.status(401).send({ message: 'Please authenticate using valid token' })
    }
    else {
        try {
            const data = jwt.verify(token, process.env.JWT_SECRET)
            req.user = data.user
            next()
        }
        catch (error) {
            res.status(401).send({ message: 'Please authenticate using valid token' })
        }
    }
}

// Creating endpoint for adding products in cartdata
app.post('/addToCart', fetchUser, async (req, res) => {
    console.log('Added', req.body.itemId)
    let userData = await Users.findOne({ _id: req.user.id })
    userData.cartData[req.body.itemId] += 1
    await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData })
    res.send({ message: 'Added' })
})

// Creating endpoint for removing products from cartdata
app.post('/removeFromCart', fetchUser, async (req, res) => {
    console.log('Removed', req.body.itemId)
    let userData = await Users.findOne({ _id: req.user.id })
    if (userData.cartData[req.body.itemId] > 0) {
        userData.cartData[req.body.itemId] -= 1
        await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData })
        res.send({ message: 'Removed' })
    }
})

// Creating endpoint for clearing products from cartdata
app.post('/clearFromCart', fetchUser, async (req, res) => {
    console.log('Cleared', req.body.itemId)
    let userData = await Users.findOne({ _id: req.user.id })
        userData.cartData[req.body.itemId] = 0
        await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData })
        res.send({ message: 'Cleared' })
})

// Creating endpoint to display all cartdata products in cart
app.post('/getCartdata', fetchUser, async (req, res) => {
    console.log('Get cart items')
    let userData = await Users.findOne({ _id: req.user.id })
    res.json(userData.cartData)
})

app.listen(port, (error) => {
    if (!error) {
        console.log('Server running on port ' + port)
    }
    else {
        console.log('Error: ' + error)
    }
})