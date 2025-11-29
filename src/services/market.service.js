const db = require('./db');
const { v4: uuidv4 } = require('uuid');

class MarketService {
    submitOrder(username, { price, quantity, delivery_start, delivery_end }) {
        // Validation
        if (!price || !quantity || !delivery_start || !delivery_end) {
            const err = new Error("Missing fields");
            err.code = 400;
            throw err;
        }

        if (quantity <= 0) {
            const err = new Error("Quantity must be positive");
            err.code = 400;
            throw err;
        }

        // 1 hour = 3,600,000 ms
        const ONE_HOUR = 3600000;

        if (delivery_start % ONE_HOUR !== 0 || delivery_end % ONE_HOUR !== 0) {
            const err = new Error("Timestamps must be aligned to 1-hour boundaries");
            err.code = 400;
            throw err;
        }

        if (delivery_end - delivery_start !== ONE_HOUR) {
            const err = new Error("Duration must be exactly 1 hour");
            err.code = 400;
            throw err;
        }

        const order = {
            order_id: uuidv4(),
            username, // seller
            price,
            quantity,
            delivery_start,
            delivery_end,
            status: 'ACTIVE'
        };

        db.addOrder(order);
        return order.order_id;
    }

    listOrders({ delivery_start, delivery_end }) {
        return db.getOrders(o => {
            if (o.status !== 'ACTIVE') return false;
            if (delivery_start && o.delivery_start < Number(delivery_start)) return false;
            if (delivery_end && o.delivery_end > Number(delivery_end)) return false;
            return true;
        }).sort((a, b) => a.price - b.price); // Cheapest first
    }

    takeOrder(buyerUsername, orderId) {
        const order = db.findOrder(orderId);
        if (!order) {
            const err = new Error("Order not found");
            err.code = 404;
            throw err;
        }

        if (order.status !== 'ACTIVE') {
            const err = new Error("Order already filled or cancelled");
            err.code = 400; // Or 409
            throw err;
        }

        if (order.username === buyerUsername) {
            const err = new Error("Cannot trade with yourself");
            err.code = 400;
            throw err;
        }

        // Execute Trade
        db.updateOrder(orderId, { status: 'FILLED' });

        const trade = {
            trade_id: uuidv4(),
            buyer_id: buyerUsername,
            seller_id: order.username,
            price: order.price,
            quantity: order.quantity,
            timestamp: Date.now()
        };

        db.addTrade(trade);
        return trade.trade_id;
    }

    listTrades() {
        return db.getTrades().sort((a, b) => b.timestamp - a.timestamp); // Newest first
    }
}

module.exports = new MarketService();
