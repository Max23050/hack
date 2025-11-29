const authService = require('../services/auth.service');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).send("Missing Authorization header");
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).send("Missing token");
    }

    try {
        const decoded = authService.verifyToken(token);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).send("Invalid token");
    }
};

module.exports = authMiddleware;
