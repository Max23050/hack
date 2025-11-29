const request = require('supertest');
const assert = require('assert');
const app = require('../server');
const GalacticBuf = require('../src/protocol/galactic-buf');
const db = require('../src/services/db');

describe('Galactic Energy Trading Integration Test', () => {
    beforeEach(() => {
        db.reset();
    });

    const binaryParser = (res, callback) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
            callback(null, Buffer.concat(chunks));
        });
    };

    it('should complete a full trading cycle', async () => {
        // 1. Register Seller
        await request(app)
            .post('/register')
            .set('Content-Type', 'application/x-galacticbuf')
            .send(GalacticBuf.encode({ username: 'seller', password: 'p1' }))
            .expect(204);

        // 2. Register Buyer
        await request(app)
            .post('/register')
            .set('Content-Type', 'application/x-galacticbuf')
            .send(GalacticBuf.encode({ username: 'buyer', password: 'p2' }))
            .expect(204);

        // 3. Login Seller
        const loginResA = await request(app)
            .post('/login')
            .set('Content-Type', 'application/x-galacticbuf')
            .send(GalacticBuf.encode({ username: 'seller', password: 'p1' }))
            .parse(binaryParser)
            .expect(200)
            .expect('Content-Type', 'application/x-galacticbuf');

        const tokenA = GalacticBuf.decode(loginResA.body).token;
        assert.ok(tokenA, "Seller should get a token");

        // 4. Login Buyer
        const loginResB = await request(app)
            .post('/login')
            .set('Content-Type', 'application/x-galacticbuf')
            .send(GalacticBuf.encode({ username: 'buyer', password: 'p2' }))
            .parse(binaryParser)
            .expect(200);

        const tokenB = GalacticBuf.decode(loginResB.body).token;
        assert.ok(tokenB, "Buyer should get a token");

        // 5. Submit Order (Seller)
        // Calculate valid timestamps
        const now = Date.now();
        const ONE_HOUR = 3600000;
        // Next full hour
        const nextHour = Math.ceil(now / ONE_HOUR) * ONE_HOUR;
        // If nextHour is too close (or in past due to drift?), add buffer. 
        // Actually, just picking a far future hour is safer.
        const deliveryStart = nextHour + ONE_HOUR * 24;
        const deliveryEnd = deliveryStart + ONE_HOUR;

        const orderData = {
            price: 100,
            quantity: 50,
            delivery_start: deliveryStart,
            delivery_end: deliveryEnd
        };

        const orderRes = await request(app)
            .post('/orders')
            .set('Authorization', `Bearer ${tokenA}`)
            .set('Content-Type', 'application/x-galacticbuf')
            .send(GalacticBuf.encode(orderData))
            .parse(binaryParser)
            .expect(200);

        const orderId = GalacticBuf.decode(orderRes.body).order_id;
        assert.ok(orderId, "Should return order_id");

        // 6. List Orders (Public)
        const listRes = await request(app)
            .get('/orders')
            .parse(binaryParser)
            .expect(200)
            .expect('Content-Type', 'application/x-galacticbuf');

        const orders = GalacticBuf.decode(listRes.body).orders;
        assert.strictEqual(orders.length, 1);
        assert.strictEqual(orders[0].order_id, orderId);
        assert.strictEqual(orders[0].price, 100);

        // 7. Take Order (Buyer)
        const tradeRes = await request(app)
            .post('/trades')
            .set('Authorization', `Bearer ${tokenB}`)
            .set('Content-Type', 'application/x-galacticbuf')
            .send(GalacticBuf.encode({ order_id: orderId }))
            .parse(binaryParser)
            .expect(200);

        const tradeId = GalacticBuf.decode(tradeRes.body).trade_id;
        assert.ok(tradeId, "Should return trade_id");

        // 8. List Orders again (should be empty)
        const listRes2 = await request(app)
            .get('/orders')
            .parse(binaryParser)
            .expect(200);

        const orders2 = GalacticBuf.decode(listRes2.body).orders;
        assert.strictEqual(orders2.length, 0, "Order should be filled and removed from list");

        // 9. List Trades
        const historyRes = await request(app)
            .get('/trades')
            .parse(binaryParser)
            .expect(200);

        const trades = GalacticBuf.decode(historyRes.body).trades;
        assert.strictEqual(trades.length, 1);
        assert.strictEqual(trades[0].trade_id, tradeId);
        assert.strictEqual(trades[0].buyer_id, 'buyer');
        assert.strictEqual(trades[0].seller_id, 'seller');
        assert.strictEqual(trades[0].price, 100);
        assert.strictEqual(trades[0].quantity, 50);
    });
});
