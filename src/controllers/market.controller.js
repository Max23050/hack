const marketService = require('../services/market.service');

exports.submitOrder = (req, res) => {
    try {
        const orderId = marketService.submitOrder(req.user.username, req.body);
        res.galactic({ order_id: orderId });
    } catch (e) {
        if (e.code) {
            res.status(e.code).send(e.message);
        } else {
            console.error(e);
            res.status(500).send("Internal Error");
        }
    }
};

exports.listOrders = (req, res) => {
    try {
        const orders = marketService.listOrders(req.query);
        // Map internal order objects to public API response if needed
        // Spec says: order_id, price, quantity, delivery_start, delivery_end
        const response = orders.map(o => ({
            order_id: o.order_id,
            price: o.price,
            quantity: o.quantity,
            delivery_start: o.delivery_start,
            delivery_end: o.delivery_end
        }));
        res.galactic({ orders: response }); // Wrap in object
    } catch (e) {
        console.error(e);
        res.status(500).send("Internal Error");
    }
};

exports.takeOrder = (req, res) => {
    try {
        const { order_id } = req.body;
        if (!order_id) {
            return res.status(400).send("Missing order_id");
        }
        const tradeId = marketService.takeOrder(req.user.username, order_id);
        res.galactic({ trade_id: tradeId });
    } catch (e) {
        if (e.code) {
            res.status(e.code).send(e.message);
        } else {
            console.error(e);
            res.status(500).send("Internal Error");
        }
    }
};

exports.listTrades = (req, res) => {
    try {
        const trades = marketService.listTrades();
        // Spec: trade_id, buyer_id, seller_id, price, quantity, timestamp
        res.galactic({ trades }); // Wrap in object
    } catch (e) {
        console.error(e);
        res.status(500).send("Internal Error");
    }
};
