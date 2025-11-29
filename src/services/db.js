class InMemoryDB {
    constructor() {
        this.users = []; // { username, password }
        this.orders = []; // { order_id, username, price, quantity, delivery_start, delivery_end, status }
        this.trades = []; // { trade_id, buyer_id, seller_id, price, quantity, timestamp }
    }

    // User methods
    findUser(username) {
        return this.users.find(u => u.username === username);
    }

    createUser(username, password) {
        if (this.findUser(username)) throw new Error("User exists");
        this.users.push({ username, password });
    }

    // Order methods
    addOrder(order) {
        this.orders.push(order);
    }

    findOrder(orderId) {
        return this.orders.find(o => o.order_id === orderId);
    }

    getOrders(filterFn) {
        return this.orders.filter(filterFn);
    }

    updateOrder(orderId, updates) {
        const order = this.findOrder(orderId);
        if (order) {
            Object.assign(order, updates);
        }
    }

    // Trade methods
    addTrade(trade) {
        this.trades.push(trade);
    }

    getTrades() {
        return this.trades;
    }

    // For testing reset
    reset() {
        this.users = [];
        this.orders = [];
        this.trades = [];
    }
}

module.exports = new InMemoryDB();
