const getRawBody = require('raw-body');
const GalacticBuf = require('../protocol/galactic-buf');

const galacticMiddleware = async (req, res, next) => {
    // Helper to send GalacticBuf response
    res.galactic = (data) => {
        try {
            const buffer = GalacticBuf.encode(data);
            res.setHeader('Content-Type', 'application/x-galacticbuf');
            res.send(buffer);
        } catch (err) {
            console.error("Encoding error:", err);
            res.status(500).send("Internal Server Error (Encoding)");
        }
    };

    if (req.method === 'GET' && req.path === '/health') {
        return next();
    }

    // For GET requests with query params, we don't expect a body, 
    // but the response might need to be GalacticBuf if it's a business endpoint.
    // The spec says "All endpoints (except GET /health and URL query parameters) communicate using this binary format."
    // This implies GET /orders and GET /trades return GalacticBuf.

    if (req.method === 'GET') {
        return next();
    }

    // For POST/PUT, we expect application/x-galacticbuf
    if (req.headers['content-type'] !== 'application/x-galacticbuf') {
        return res.status(415).send('Unsupported Media Type. Use application/x-galacticbuf');
    }

    try {
        const buffer = await getRawBody(req);
        if (buffer.length > 0) {
            req.body = GalacticBuf.decode(buffer);
        } else {
            req.body = {};
        }
        next();
    } catch (err) {
        console.error("Decoding error:", err);
        res.status(400).send('Invalid GalacticBuf Message');
    }
};

module.exports = galacticMiddleware;
