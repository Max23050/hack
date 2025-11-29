const authService = require('../services/auth.service');

exports.register = (req, res) => {
    try {
        const { username, password } = req.body;
        authService.register(username, password);
        res.status(204).send();
    } catch (e) {
        if (e.code) {
            res.status(e.code).send(e.message);
        } else {
            console.error(e);
            res.status(500).send("Internal Error");
        }
    }
};

exports.login = (req, res) => {
    try {
        const { username, password } = req.body;
        const token = authService.login(username, password);
        // Response must be GalacticBuf
        res.galactic({ token });
    } catch (e) {
        if (e.code) {
            res.status(e.code).send(e.message);
        } else {
            console.error(e);
            res.status(500).send("Internal Error");
        }
    }
};
