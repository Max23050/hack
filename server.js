const express = require('express');
const galacticMiddleware = require('./src/middleware/galactic-middleware');
const authMiddleware = require('./src/middleware/auth-middleware');
const authController = require('./src/controllers/auth.controller');
const marketController = require('./src/controllers/market.controller');
const systemController = require('./src/controllers/system.controller');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(galacticMiddleware);

// Routes

// System
app.get('/health', systemController.health);

// Auth
app.post('/register', authController.register);
app.post('/login', authController.login);

// Market
app.post('/orders', authMiddleware, marketController.submitOrder);
app.get('/orders', marketController.listOrders);
app.post('/trades', authMiddleware, marketController.takeOrder);
app.get('/trades', marketController.listTrades);

// Start server if not imported (for testing)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
