const db = require('./db');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'super-secret-hackathon-key';

class AuthService {
    register(username, password) {
        if (!username || !password) {
            throw new Error("Invalid input");
        }
        try {
            db.createUser(username, password);
        } catch (e) {
            if (e.message === "User exists") {
                const err = new Error("User exists");
                err.code = 409;
                throw err;
            }
            throw e;
        }
    }

    login(username, password) {
        const user = db.findUser(username);
        if (!user || user.password !== password) {
            const err = new Error("Invalid credentials");
            err.code = 401;
            throw err;
        }

        const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1h' });
        return token;
    }

    verifyToken(token) {
        try {
            return jwt.verify(token, SECRET_KEY);
        } catch (e) {
            throw new Error("Invalid token");
        }
    }
}

module.exports = new AuthService();
