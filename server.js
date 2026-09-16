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
        if (filePath.endsWith('.mp4') || filePath.endsWith('.webm')) {
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Type', filePath.endsWith('.mp4') ? 'video/mp4' : 'video/webm');
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
        'whatsapp': '923347382564',
        'currency': '₨',
        'free_shipping_min': '3000',
        'shipping_charge': '200',
        'announcement': '🚚 Free Delivery Above ₨3000 | 💵 Cash on Delivery All Pakistan',
        'flash_sale_text': '🔥 FLASH SALE — Up to 40% OFF!',
        'about_text': 'Premium Fashion Pakistan — Est. 2024',
        'primary_color': '#c8973a',
        'dark_color': '#0d0d1a',
        'total_products': '40'
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
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

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

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
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
    const { orderNo, customerName, customerPhone, customerEmail, address, province, city, tehsil, items, subtotal, couponDiscount, giftFee, shipping, total, paymentMethod, giftWrap, notes } = req.body;
    db.run(
        `INSERT INTO orders (order_no, customer_name, customer_phone, customer_email, address, province, city, tehsil, items, subtotal, coupon_discount, gift_fee, shipping, total, payment_method, gift_wrap, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [orderNo, customerName, customerPhone, customerEmail, address, province, city, tehsil, JSON.stringify(items), subtotal, couponDiscount || 0, giftFee || 0, shipping, total, paymentMethod, giftWrap ? 1 : 0, notes || ''],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            const notif = {
                type: 'new_order',
                title: '🛍️ New Order!',
                message: `${customerName} ne ₨${total.toLocaleString()} ka order kiya`,
                data: { orderId: this.lastID, orderNo, customerName, total }
            };
            saveNotification(notif);
            io.emit('new_order', notif);
            console.log(`🔔 NEW ORDER: ${orderNo} - ${customerName} - ₨${total}`);
            res.json({ success: true, id: this.lastID, orderNo });
        }
    );
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

// ═══ SOCKET.IO ═══
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
    console.log(`   Password: ${ADMIN_PASS}`);
    console.log('');
    console.log('═══════════════════════════════════════════════');
});
