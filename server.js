// ═══════════════════════════════════════════════
// 🚀 BASIM STORE — COMPLETE BACKEND SERVER v2.0
// ═══════════════════════════════════════════════

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

// ═══ CONFIG ═══
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'basim-store-secret';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'basim2025';

// ═══ PATHS (Persistent Disk Support) ═══
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = process.env.DATA_DIR
    ? path.join(process.env.DATA_DIR, 'uploads')
    : path.join(__dirname, 'uploads');

// Ensure all folders exist
[DATA_DIR, UPLOAD_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created: ${dir}`);
    }
});

// ═══ APP SETUP ═══
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static folders
app.use('/uploads', express.static(UPLOAD_DIR, {
    acceptRanges: true,
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.mp4') || filePath.endsWith('.webm') || filePath.endsWith('.ogg') || filePath.endsWith('.mov')) {
            res.setHeader('Accept-Ranges', 'bytes');
            const ext = path.extname(filePath).toLowerCase();
            const typeMap = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg', '.mov': 'video/quicktime' };
            res.setHeader('Content-Type', typeMap[ext] || 'application/octet-stream');
        }
    }
}));

app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/', express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════
// 🗄️ DATABASE SETUP
// ═══════════════════════════════════════════════
const dbPath = path.join(DATA_DIR, 'database.db');
console.log(`📀 Database: ${dbPath}`);
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // ═══ PRODUCTS ═══
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        original_price INTEGER,
        discount INTEGER DEFAULT 0,
        category TEXT,
        color TEXT,
        size TEXT,
        material TEXT,
        description TEXT,
        images TEXT,
        videos TEXT,
        stock INTEGER DEFAULT 100,
        featured INTEGER DEFAULT 0,
        is_new INTEGER DEFAULT 0,
        rating REAL DEFAULT 4.5,
        reviews INTEGER DEFAULT 50,
        display_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // ═══ ORDERS ═══
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT UNIQUE,
        customer_name TEXT,
        customer_phone TEXT,
        customer_email TEXT,
        address TEXT,
        province TEXT,
        city TEXT,
        tehsil TEXT,
        items TEXT,
        subtotal INTEGER,
        coupon_discount INTEGER DEFAULT 0,
        gift_fee INTEGER DEFAULT 0,
        shipping INTEGER,
        total INTEGER,
        payment_method TEXT,
        gift_wrap INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // ═══ CATEGORIES ═══
    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        slug TEXT UNIQUE,
        icon TEXT,
        display_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
    )`);

    // ═══ SOCIAL MEDIA (UNIQUE constraint REMOVED) ═══
    db.run(`CREATE TABLE IF NOT EXISTS social_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        description TEXT,
        display_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
    )`);

    // ═══ COUPONS ═══
    db.run(`CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        type TEXT,
        value INTEGER,
        description TEXT,
        min_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1
    )`);

    // ═══ SETTINGS ═══
    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    // ═══ NOTIFICATIONS ═══
    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        title TEXT,
        message TEXT,
        data TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // ═══ DEFAULT SETTINGS ═══
    const defaults = {
        'store_name': 'Basim Store',
        'tagline': 'Premium Fashion for Everyone',
        'hero_subtitle': 'Discover 400+ exclusive styles',
        'hero_tag': '✨ New Season 2025',
        'hero_btn_primary': 'Shop Now →',
        'hero_btn_secondary': 'Categories',
        'whatsapp': '923347382564',
        'currency': '₨',
        'free_shipping_min': '3000',
        'shipping_charge': '200',
        'announcement': '🚚 Free Delivery Above ₨3000 | 💵 Cash on Delivery All Pakistan',
        'flash_sale_text': '🔥 FLASH SALE — Up to 40% OFF!',
        'about_text': 'Premium Fashion Pakistan — Est. 2024',
        'about_sub': 'Premium Fashion — Est. 2024',
        'about_stat1_val': '400+',
        'about_stat1_lbl': 'Products',
        'about_stat2_val': '41K+',
        'about_stat2_lbl': 'Customers',
        'about_stat3_val': '⭐4.8',
        'about_stat3_lbl': 'Rating',
        'about_why_title': 'Why Choose Us',
        'footer_text': 'Made with ❤️ in Pakistan',
        'primary_color': '#c8973a',
        'dark_color': '#0d0d1a',
        'total_products': '40',
        'logo_text': 'BASIM',
        'spin_enabled': '1',
        'size_guide_tip': 'If between sizes, go one size up for a comfortable fit.',
        'logo_url': '',
        'default_dark': '0',
        'default_urdu': '0',
        'pwa_name': 'Basim Store',
        'pwa_short_name': 'Basim',
        'bot_replies': '["Shukriya! Hum aapki madad karne ke liye hamesha tayyar hain! 😊","Yeh product bohot popular hai! Abhi order karein! 🛍️","Delivery 3-5 working days mein hoti hai. COD available hai! 🚚","Koi bhi problem ho toh WhatsApp karein 💬","Aapka coupon code SAVE15 use karein 15% discount ke liye! 🏷️","Bohot khoobsurat choice! Yeh item bestseller hai! ⭐"]',
        'size_guide_json': '[{"size":"S","chest":"34–36","waist":"28–30","hip":"36–38","height":"155–160"},{"size":"M","chest":"38–40","waist":"32–34","hip":"40–42","height":"160–165"},{"size":"L","chest":"42–44","waist":"36–38","hip":"44–46","height":"165–170"},{"size":"XL","chest":"46–48","waist":"40–42","hip":"48–50","height":"170–175"},{"size":"XXL","chest":"50–52","waist":"44–46","hip":"52–54","height":"175–180"}]',
        'spin_prizes_json': '[{"label":"10% OFF","color":"#c8973a","text":"10% OFF","coupon":"SPIN10"},{"label":"15% OFF","color":"#a8844a","text":"15% OFF","coupon":"SPIN15"},{"label":"20% OFF","color":"#8b6914","text":"20% OFF","coupon":"SPIN20"},{"label":"FLAT 200","color":"#25D366","text":"₨200 OFF","coupon":"FLAT200"},{"label":"Try Again","color":"#666","text":"Better luck!","coupon":"SPINFREE"},{"label":"5% OFF","color":"#e67e22","text":"5% OFF","coupon":"SPIN5"}]',
        'trust_points': '["Premium Quality Fabrics","Cash on Delivery All Pakistan","7-Day Easy Returns","Fast 3-5 Day Delivery"]'
    };

    Object.entries(defaults).forEach(([key, value]) => {
        db.run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    });

    // ═══ DEFAULT CATEGORIES ═══
    const defaultCats = [
        ['Shirts', 'shirt', '👔', 1],
        ['Dresses', 'dress', '👗', 2],
        ['Pants', 'pants', '👖', 3],
        ['Jackets', 'jacket', '🧥', 4],
        ['Sports', 'sports', '🏃', 5],
        ['Party', 'party', '🎉', 6],
        ['Tops', 'top', '👕', 7],
        ['Skirts', 'skirt', '👚', 8]
    ];
    defaultCats.forEach(([name, slug, icon, order]) => {
        db.run(`INSERT OR IGNORE INTO categories (name, slug, icon, display_order) VALUES (?, ?, ?, ?)`, [name, slug, icon, order]);
    });

    // ═══════════════════════════════════════════════
    // ⚠️ DEFAULT SOCIAL SEED — COMMENTED OUT
    // ═══════════════════════════════════════════════
    // Kyun comment kiya: Server restart par delete kiye hue social wapas aate thay.
    // Ab aap manually admin panel se social add karein.
    //
    // const defaultSocial = [
    //     ['whatsapp', 'WhatsApp', 'https://wa.me/923347382564', '💬', 'linear-gradient(135deg,#25D366,#128C7E)', 'Chat & order directly', 1],
    //     ['instagram', 'Instagram', 'https://instagram.com/nawabwrite786', '📸', 'linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)', 'Photos & stories', 2],
    //     ['facebook', 'Facebook', 'https://facebook.com/basimstore', '📘', 'linear-gradient(135deg,#1877F2,#0a5bb5)', 'Like & follow us', 3],
    //     ['youtube', 'YouTube', 'https://youtube.com/@nawabwrite', '▶️', 'linear-gradient(135deg,#FF0000,#cc0000)', 'Watch product demos', 4],
    //     ['tiktok', 'TikTok', 'https://tiktok.com/@basimstore', '🎵', 'linear-gradient(135deg,#010101,#69C9D0,#010101)', 'Videos & trends', 5]
    // ];
    // defaultSocial.forEach(([platform, name, url, icon, color, description, order]) => {
    //     db.run(`INSERT OR IGNORE INTO social_media (platform, name, url, icon, color, description, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)`, [platform, name, url, icon, color, description, order]);
    // });

    // ═══ DEFAULT COUPONS ═══
    const defaultCoupons = [
        ['SAVE15', 'percent', 15, '15% off', 0],
        ['WELCOME10', 'percent', 10, '10% off', 0],
        ['FLAT200', 'flat', 200, '₨200 off', 2000],
        ['BASIM50', 'flat', 50, '₨50 off', 0]
    ];
    defaultCoupons.forEach(([code, type, value, desc, min]) => {
        db.run(`INSERT OR IGNORE INTO coupons (code, type, value, description, min_order) VALUES (?, ?, ?, ?, ?)`, [code, type, value, desc, min]);
    });

    // ═══ STARTER PRODUCTS (fresh install ke liye — inke bina orders fail hote hain) ═══
    const PLACEHOLDER_IMG = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22400%22 height=%22400%22%3E%3Crect fill=%22%23f0ede8%22 width=%22400%22 height=%22400%22/%3E%3Ctext fill=%22%23b0a090%22 x=%22200%22 y=%22215%22 text-anchor=%22middle%22 font-size=%2260%22%3E%F0%9F%91%95%3C/text%3E%3C/svg%3E';
    const starterProducts = [
        ['Classic Formal Shirt', 1799, 2499, 28, 'shirt', 'White', 'M', 'Cotton', 'Premium cotton formal shirt, perfect for office wear.', 1],
        ['Casual Polo Shirt', 1499, 1999, 25, 'shirt', 'Navy Blue', 'L', 'Cotton', 'Comfortable everyday polo shirt.', 1],
        ['Designer Party Dress', 3499, 4999, 30, 'dress', 'Maroon', 'M', 'Silk', 'Elegant party wear dress for special occasions.', 1],
        ['Slim Fit Jeans', 2199, 2799, 21, 'pants', 'Black', 'L', 'Denim', 'Slim fit denim jeans, all-day comfort.', 0],
        ['Leather Jacket', 4999, 6999, 29, 'jacket', 'Black', 'L', 'Leather', 'Premium leather jacket for a bold look.', 1],
        ['Sports Track Suit', 2499, 3199, 22, 'sports', 'Gray', 'XL', 'Polyester', 'Breathable track suit for gym and outdoor sports.', 0],
        ['Festive Kurti', 1899, 2399, 21, 'top', 'Beige', 'M', 'Cotton', 'Traditional festive kurti with fine embroidery.', 0],
        ['A-Line Skirt', 1599, 1999, 20, 'skirt', 'Olive Green', 'S', 'Cotton', 'Comfortable A-line skirt for everyday wear.', 0]
    ];
    db.get('SELECT COUNT(*) as c FROM products', (err, row) => {
        if (!err && row && row.c === 0) {
            starterProducts.forEach(([name, price, original_price, discount, category, color, size, material, description, featured]) => {
                db.run(
                    `INSERT INTO products (name, price, original_price, discount, category, color, size, material, description, images, videos, stock, featured, is_new)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [name, price, original_price, discount, category, color, size, material, description, JSON.stringify([PLACEHOLDER_IMG]), JSON.stringify([]), 100, featured, 1]
                );
            });
            console.log('🌱 Seeded 8 starter products (orders will now work on fresh install)');
        }
    });

    console.log('✅ Database initialized with defaults');
});

// ═══ FILE UPLOAD ═══
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /^(image\/(jpeg|jpg|png|gif|webp|svg\+xml)|video\/(mp4|webm|ogg|quicktime))$/i;
        if (allowed.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images (jpg, png, gif, webp) and videos (mp4, webm) are allowed'), false);
        }
    }
});

// ═══ LOGIN RATE LIMITER (blocks brute-force on /api/admin/login) ═══
const loginAttempts = new Map(); // ip -> { count, firstAttempt }
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 5;

function loginRateLimiter(req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = loginAttempts.get(ip);

    if (!record || now - record.firstAttempt > LOGIN_WINDOW_MS) {
        loginAttempts.set(ip, { count: 1, firstAttempt: now });
        return next();
    }

    if (record.count >= LOGIN_MAX_ATTEMPTS) {
        const waitMin = Math.ceil((LOGIN_WINDOW_MS - (now - record.firstAttempt)) / 60000);
        return res.status(429).json({ error: `Bohot zyada attempts. ${waitMin} minute baad try karein.` });
    }

    record.count++;
    next();
}

// Periodically clean up old entries so the map doesn't grow forever
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of loginAttempts.entries()) {
        if (now - record.firstAttempt > LOGIN_WINDOW_MS) loginAttempts.delete(ip);
    }
}, 10 * 60 * 1000);

// ═══ AUTH MIDDLEWARE ═══
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}

// ═══ NOTIFICATION HELPER ═══
function saveNotification(notif) {
    db.run(
        'INSERT INTO notifications (type, title, message, data) VALUES (?, ?, ?, ?)',
        [notif.type, notif.title, notif.message, JSON.stringify(notif.data || {})],
        function(err) {
            if (err) console.error('Notification error:', err);
            else {
                io.emit('notification', { id: this.lastID, ...notif, created_at: new Date() });
            }
        }
    );
}

// ═══════════════════════════════════════════════
// 🔐 AUTH ROUTES
// ═══════════════════════════════════════════════

app.post('/api/admin/login', loginRateLimiter, async (req, res) => {
    const { username, password } = req.body;
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
    if (username !== ADMIN_USER) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    try {
        // Support both hashed and plain (migration)
        let valid = false;
        if (ADMIN_PASS.startsWith('$2')) {
            valid = await bcrypt.compare(password, ADMIN_PASS);
        } else {
            valid = (password === ADMIN_PASS);
            // Auto-hash on successful plain login for future
            if (valid) {
                const hash = await bcrypt.hash(password, 10);
                console.log('⚠️  Please set ADMIN_PASSWORD to this hash in .env for security:');
                console.log(hash);
            }
        }
        if (valid) {
            loginAttempts.delete(ip);
            const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ success: true, token });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/admin/verify', authMiddleware, (req, res) => {
    res.json({ valid: true });
});

// ═══════════════════════════════════════════════
// 📦 PRODUCTS API
// ═══════════════════════════════════════════════

app.get('/api/products', (req, res) => {
    const { category, search, limit, featured } = req.query;
    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params = [];

    if (category && category !== 'all') { query += ' AND category = ?'; params.push(category); }
    if (search) { query += ' AND (name LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (featured === 'true') { query += ' AND featured = 1'; }

    query += ' ORDER BY display_order ASC, id DESC';
    if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const products = rows.map(p => ({
            ...p,
            images: p.images ? JSON.parse(p.images) : [],
            videos: p.videos ? JSON.parse(p.videos) : [],
            isFeatured: p.featured === 1,
            isNew: p.is_new === 1,
            reviewCount: p.reviews,
            originalPrice: p.original_price
        }));
        res.json({ products, total: products.length });
    });
});

app.get('/api/products/:id', (req, res) => {
    db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Not found' });
        row.images = row.images ? JSON.parse(row.images) : [];
        row.videos = row.videos ? JSON.parse(row.videos) : [];
        res.json(row);
    });
});

app.post('/api/products', authMiddleware, (req, res) => {
    const { name, price, originalPrice, discount, category, color, size, material, description, images, videos, stock, featured, isNew, rating } = req.body;
    db.run(
        `INSERT INTO products (name, price, original_price, discount, category, color, size, material, description, images, videos, stock, featured, is_new, rating)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, price, originalPrice || price, discount || 0, category, color, size, material, description, JSON.stringify(images || []), JSON.stringify(videos || []), stock || 100, featured ? 1 : 0, isNew ? 1 : 0, rating || 4.5],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            saveNotification({ type: 'product_added', title: '🆕 New Product', message: `"${name}" added`, data: { id: this.lastID } });
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.put('/api/products/:id', authMiddleware, (req, res) => {
    const { name, price, originalPrice, discount, category, color, size, material, description, images, videos, stock, featured, isNew } = req.body;
    db.run(
        `UPDATE products SET name = ?, price = ?, original_price = ?, discount = ?, category = ?, color = ?, size = ?, material = ?, description = ?, images = ?, videos = ?, stock = ?, featured = ?, is_new = ? WHERE id = ?`,
        [name, price, originalPrice, discount, category, color, size, material, description, JSON.stringify(images), JSON.stringify(videos || []), stock, featured ? 1 : 0, isNew ? 1 : 0, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            saveNotification({ type: 'product_updated', title: '✏️ Product Updated', message: `"${name}" updated` });
            res.json({ success: true });
        }
    );
});

app.delete('/api/products/:id', authMiddleware, (req, res) => {
    db.get('SELECT name FROM products WHERE id = ?', [req.params.id], (err, row) => {
        if (err || !row) return res.status(404).json({ error: 'Not found' });
        db.run('DELETE FROM products WHERE id = ?', [req.params.id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            saveNotification({ type: 'product_deleted', title: '🗑️ Product Deleted', message: `"${row.name}" deleted` });
            res.json({ success: true });
        });
    });
});

// ═══════════════════════════════════════════════
// 📸 IMAGE / VIDEO UPLOAD
// ═══════════════════════════════════════════════

app.post('/api/upload', authMiddleware, upload.fields([
    { name: 'images', maxCount: 20 },
    { name: 'videos', maxCount: 10 },
    { name: 'files', maxCount: 20 }
]), (req, res) => {
    const allFiles = [];
    if (req.files) {
        Object.values(req.files).forEach(arr => {
            if (Array.isArray(arr)) allFiles.push(...arr);
        });
    }
    const urls = allFiles.map(f => `/uploads/${f.filename}`);
    res.json({ success: true, urls });
});

// ═══════════════════════════════════════════════
// 🛒 ORDERS API
// ═══════════════════════════════════════════════

app.post('/api/orders', (req, res) => {
    const { orderNo, customerName, customerPhone, customerEmail, address, province, city, tehsil, items, couponDiscount, giftFee, shipping, paymentMethod, giftWrap, notes } = req.body;

    if (!orderNo || !customerName || !customerPhone || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Missing required order fields' });
    }

    // Server-side price recalculation + stock check
    const productIds = items.map(i => i.id || i.productId).filter(Boolean);
    if (productIds.length === 0) {
        return res.status(400).json({ error: 'Invalid items' });
    }

    const placeholders = productIds.map(() => '?').join(',');
    db.all(`SELECT id, name, price, stock FROM products WHERE id IN (${placeholders}) AND is_active = 1`, productIds, (err, products) => {
        if (err) return res.status(500).json({ error: err.message });

        const productMap = {};
        products.forEach(p => { productMap[p.id] = p; });

        let calculatedSubtotal = 0;
        const validatedItems = [];

        for (const item of items) {
            const pid = item.id || item.productId;
            const dbProduct = productMap[pid];
            if (!dbProduct) {
                return res.status(400).json({ error: `Product not found: ${item.name || pid}` });
            }
            const qty = Math.max(1, parseInt(item.qty) || 1);
            if (dbProduct.stock < qty) {
                return res.status(400).json({ error: `Insufficient stock for ${dbProduct.name}. Available: ${dbProduct.stock}` });
            }
            const unitPrice = dbProduct.price; // Always use DB price
            calculatedSubtotal += unitPrice * qty;
            validatedItems.push({
                id: dbProduct.id,
                name: dbProduct.name,
                qty,
                price: unitPrice
            });
        }

        const safeCoupon = Math.max(0, parseInt(couponDiscount) || 0);
        const safeGift = giftWrap ? (parseInt(giftFee) || 150) : 0;
        const safeShipping = Math.max(0, parseInt(shipping) || 0);
        const calculatedTotal = Math.max(0, calculatedSubtotal - safeCoupon + safeGift + safeShipping);

        db.run(
            `INSERT INTO orders (order_no, customer_name, customer_phone, customer_email, address, province, city, tehsil, items, subtotal, coupon_discount, gift_fee, shipping, total, payment_method, gift_wrap, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderNo, customerName, customerPhone, customerEmail || '', address || '', province || '', city || '', tehsil || '', JSON.stringify(validatedItems), calculatedSubtotal, safeCoupon, safeGift, safeShipping, calculatedTotal, paymentMethod || 'cod', giftWrap ? 1 : 0, notes || ''],
            function(err) {
                if (err) return res.status(500).json({ error: err.message });

                // Decrease stock for each item
                validatedItems.forEach(item => {
                    db.run('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?', [item.qty, item.id, item.qty]);
                });

                const notif = {
                    type: 'new_order',
                    title: '🛍️ New Order!',
                    message: `${customerName} ne ₨${calculatedTotal.toLocaleString()} ka order kiya`,
                    data: { orderId: this.lastID, orderNo, customerName, total: calculatedTotal }
                };
                saveNotification(notif);
                io.emit('new_order', notif);
                console.log(`🔔 NEW ORDER: ${orderNo} - ${customerName} - ₨${calculatedTotal}`);
                res.json({ success: true, id: this.lastID, orderNo, total: calculatedTotal });
            }
        );
    });
});

app.get('/api/orders', authMiddleware, (req, res) => {
    const { status, limit } = req.query;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];
    if (status && status !== 'all') { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY id DESC';
    if (limit) { query += ' LIMIT ?'; params.push(parseInt(limit)); }
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const orders = rows.map(o => ({ ...o, items: o.items ? JSON.parse(o.items) : [], giftWrap: o.gift_wrap === 1 }));
        res.json({ orders, total: orders.length });
    });
});

app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
    const { status } = req.body;
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        saveNotification({ type: 'order_status', title: '📦 Order Status', message: `Order #${req.params.id} → ${status}` });
        res.json({ success: true });
    });
});

app.delete('/api/orders/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM orders WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ═══════════════════════════════════════════════
// 📂 CATEGORIES API
// ═══════════════════════════════════════════════

app.get('/api/categories', (req, res) => {
    db.all('SELECT * FROM categories WHERE is_active = 1 ORDER BY display_order ASC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ categories: rows });
    });
});

app.post('/api/categories', authMiddleware, (req, res) => {
    const { name, slug, icon } = req.body;
    if (!name || !slug) return res.status(400).json({ error: 'Name and slug required' });
    db.run('INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)', [name, slug, icon || '📁'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.put('/api/categories/:id', authMiddleware, (req, res) => {
    const { name, slug, icon, is_active } = req.body;
    db.run('UPDATE categories SET name = ?, slug = ?, icon = ?, is_active = ? WHERE id = ?',
        [name, slug, icon, is_active ? 1 : 0, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/categories/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM categories WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ═══════════════════════════════════════════════
// 🔗 SOCIAL MEDIA API (FIXED — No UNIQUE constraint)
// ═══════════════════════════════════════════════

app.get('/api/social', (req, res) => {
    db.all('SELECT * FROM social_media WHERE is_active = 1 ORDER BY display_order ASC, id ASC', (err, rows) => {
        if (err) {
            console.error('Social fetch error:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ social: rows });
    });
});

app.post('/api/social', authMiddleware, (req, res) => {
    const { platform, name, url, icon, color, description } = req.body;

    if (!platform || !name || !url) {
        return res.status(400).json({ error: 'Platform, Name, aur URL zaroori hain' });
    }

    db.run(
        'INSERT INTO social_media (platform, name, url, icon, color, description) VALUES (?, ?, ?, ?, ?, ?)',
        [
            platform.trim(),
            name.trim(),
            url.trim(),
            icon || '🔗',
            color || 'linear-gradient(135deg,#666,#333)',
            description || ''
        ],
        function(err) {
            if (err) {
                console.error('Social insert error:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log(`✅ Social added: ${name} (${platform})`);
            res.json({ success: true, id: this.lastID });
        }
    );
});

app.put('/api/social/:id', authMiddleware, (req, res) => {
    const { platform, name, url, icon, color, description, is_active } = req.body;

    if (!platform || !name || !url) {
        return res.status(400).json({ error: 'Platform, Name, aur URL zaroori hain' });
    }

    db.run(
        'UPDATE social_media SET platform = ?, name = ?, url = ?, icon = ?, color = ?, description = ?, is_active = ? WHERE id = ?',
        [
            platform.trim(),
            name.trim(),
            url.trim(),
            icon || '🔗',
            color || 'linear-gradient(135deg,#666,#333)',
            description || '',
            is_active === undefined ? 1 : (is_active ? 1 : 0),
            req.params.id
        ],
        function(err) {
            if (err) {
                console.error('Social update error:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log(`✅ Social updated: ${name}`);
            res.json({ success: true });
        }
    );
});

app.delete('/api/social/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM social_media WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            console.error('Social delete error:', err);
            return res.status(500).json({ error: err.message });
        }
        console.log(`🗑️ Social deleted: ID ${req.params.id}`);
        res.json({ success: true });
    });
});

// ═══════════════════════════════════════════════
// 🎟️ COUPONS API
// ═══════════════════════════════════════════════

app.get('/api/coupons', (req, res) => {
    db.all('SELECT * FROM coupons WHERE is_active = 1', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ coupons: rows });
    });
});

app.post('/api/coupons', authMiddleware, (req, res) => {
    const { code, type, value, description, min_order } = req.body;
    if (!code || !type || !value) {
        return res.status(400).json({ error: 'Code, type, aur value zaroori hain' });
    }
    db.run('INSERT INTO coupons (code, type, value, description, min_order) VALUES (?, ?, ?, ?, ?)',
        [code.toUpperCase().trim(), type, value, description || '', min_order || 0], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: this.lastID });
    });
});

app.delete('/api/coupons/:id', authMiddleware, (req, res) => {
    db.run('DELETE FROM coupons WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ═══════════════════════════════════════════════
// ⚙️ SETTINGS API
// ═══════════════════════════════════════════════

app.get('/api/settings', (req, res) => {
    db.all('SELECT * FROM settings', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings = {};
        rows.forEach(r => settings[r.key] = r.value);
        res.json(settings);
    });
});

app.put('/api/settings', authMiddleware, (req, res) => {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'Invalid data' });
    }

    // Defense-in-depth: reject invalid JSON for fields the frontend parses as JSON,
    // so a bad request (bypassing the admin UI's own check) can't break the site.
    const jsonKeys = ['spin_prizes_json', 'size_guide_json', 'bot_replies', 'trust_points'];
    for (const key of jsonKeys) {
        if (updates[key] !== undefined && String(updates[key]).trim() !== '') {
            try {
                JSON.parse(updates[key]);
            } catch (e) {
                return res.status(400).json({ error: `Invalid JSON for "${key}"` });
            }
        }
    }

    db.serialize(() => {
        Object.entries(updates).forEach(([key, value]) => {
            db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
        });
    });
    res.json({ success: true });
});

// ═══════════════════════════════════════════════
// 🔔 NOTIFICATIONS API
// ═══════════════════════════════════════════════

app.get('/api/notifications', authMiddleware, (req, res) => {
    db.all('SELECT * FROM notifications ORDER BY id DESC LIMIT 50', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ notifications: rows });
    });
});

app.put('/api/notifications/:id/read', authMiddleware, (req, res) => {
    db.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.put('/api/notifications/read-all', authMiddleware, (req, res) => {
    db.run('UPDATE notifications SET is_read = 1', (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ═══════════════════════════════════════════════
// 📊 DASHBOARD STATS
// ═══════════════════════════════════════════════

app.get('/api/admin/stats', authMiddleware, (req, res) => {
    db.get('SELECT COUNT(*) as total FROM products WHERE is_active = 1', (e, products) => {
        db.get('SELECT COUNT(*) as total FROM orders', (e2, orders) => {
            db.get("SELECT COUNT(*) as total FROM orders WHERE status = 'Pending'", (e3, pending) => {
                db.get("SELECT COALESCE(SUM(total), 0) as revenue FROM orders WHERE status != 'Cancelled'", (e4, revenue) => {
                    db.get('SELECT COUNT(*) as unread FROM notifications WHERE is_read = 0', (e5, notifications) => {
                        res.json({
                            products: products?.total || 0,
                            orders: orders?.total || 0,
                            pendingOrders: pending?.total || 0,
                            revenue: revenue?.revenue || 0,
                            unreadNotifications: notifications?.unread || 0
                        });
                    });
                });
            });
        });
    });
});

// ═══ SOCKET.IO (auth required — only logged-in admins get order/notification events) ═══
io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('No token'));
    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    console.log('🔌 Admin connected:', socket.id);
    socket.on('disconnect', () => console.log('❌ Disconnected:', socket.id));
});

// ═══ GLOBAL ERROR HANDLER ═══
app.use((err, req, res, next) => {
    if (err.name === 'RangeNotSatisfiableError' || err.status === 416) {
        res.status(416).send('Range Not Satisfiable');
        return;
    }
    console.error('❌ Server Error:', err.message);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══ START SERVER ═══
server.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════');
    console.log('🚀 BASIM STORE SERVER STARTED v2.0');
    console.log('═══════════════════════════════════════════════');
    console.log('');
    console.log(`📀 Data Directory: ${DATA_DIR}`);
    console.log(`📸 Uploads:       ${UPLOAD_DIR}`);
    console.log('');
    console.log(`🌐 User Website:  http://localhost:${PORT}/`);
    console.log(`👑 Admin Panel:   http://localhost:${PORT}/admin/`);
    console.log(`🔌 API:           http://localhost:${PORT}/api/`);
    console.log('');
    console.log('📋 Admin Credentials:');
    console.log(`   Username: ${ADMIN_USER}`);
    console.log(`   Password: ${ADMIN_PASS.startsWith('$2') ? '(hashed in .env)' : ADMIN_PASS}`);
    console.log('');

    const isProd = process.env.NODE_ENV === 'production';
    const weakSecret = !process.env.JWT_SECRET;
    const weakPassword = !ADMIN_PASS.startsWith('$2') && ADMIN_PASS === 'basim2025';
    if (weakSecret || weakPassword) {
        console.log('⚠️⚠️⚠️  SECURITY WARNING ⚠️⚠️⚠️');
        if (weakSecret) console.log('   - JWT_SECRET .env mein set nahi hai (default use ho raha hai)');
        if (weakPassword) console.log('   - ADMIN_PASSWORD abhi bhi default "basim2025" hai');
        console.log(isProd ? '   🔴 NODE_ENV=production hai — turant .env mein change karein!' : '   .env file banake production se pehle change kar lein.');
        console.log('');
    }

    console.log('═══════════════════════════════════════════════');
});
