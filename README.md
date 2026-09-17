# 🛍️ Basim Store — E-Commerce Platform

Complete e-commerce solution with user website, admin panel, and backend.

## Features

### User Website
- 40+ products with images/videos
- Cart & wishlist
- Order placement via WhatsApp
- Dark mode + Urdu language
- Mobile-responsive

### Admin Panel
- Products CRUD (images + videos)
- Orders management
- Categories + Social media + Coupons
- Real-time notifications
- Store settings

### Backend
- Node.js + Express
- SQLite database
- JWT authentication
- Socket.io real-time notifications
- Multer file uploads

## Quick Start

### 1. Install Dependencies
npm install

### 2. Setup Environment
cp .env.example .env

### 3. Start Server
npm start

### 4. Access
- User Website: http://localhost:3000/
- Admin Panel: http://localhost:3000/admin/
- API: http://localhost:3000/api/

## Default Credentials

- Username: admin
- Password: basim2025

WARNING: Change these in production!

## Project Structure

basim-store/
- server.js
- package.json
- .env.example
- .gitignore
- public/
  - index.html
  - manifest.json
  - service-worker.js
- admin/
  - admin.css
  - login.html
  - dashboard.html
  - products.html
  - orders.html
  - settings.html
- uploads/

## Deploy on Render.com

1. Push code to GitHub
2. Go to render.com
3. Create New Web Service
4. Connect GitHub repository
5. Build Command: npm install
6. Start Command: npm start
7. Add environment variables
8. Deploy!

## License

MIT License - Free to use, modify, distribute.

## Author

CSK4 - Made with love in Pakistan

## Support

- WhatsApp: +92 334 7382564
- Instagram: @nawabwrite786
- YouTube: @nawabwrite
