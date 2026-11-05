const session = require("express-session");
class MysqlSessionStore extends session.Store {
    constructor(pool) { super(); this.pool = pool; this.nextCleanup = 0; }
    get(sid, callback) {
        this.pool.execute("SELECT data FROM sesiones WHERE sid = ? AND expires_at > ?", [sid, Date.now()])
            .then(([rows]) => callback(null, rows.length ? JSON.parse(rows[0].data) : null)).catch(callback);
    }
    set(sid, value, callback = () => {}) {
        const expires = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 14400000;
        this.pool.execute("INSERT INTO sesiones (sid, data, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), expires_at = VALUES(expires_at)", [sid, JSON.stringify(value), expires])
            .then(async () => {
                if (Date.now() >= this.nextCleanup) {
                    this.nextCleanup = Date.now() + 3600000;
                    await this.pool.execute("DELETE FROM sesiones WHERE expires_at <= ?", [Date.now()]);
                }
                callback(null);
            }).catch(callback);
    }
    destroy(sid, callback = () => {}) {
        this.pool.execute("DELETE FROM sesiones WHERE sid = ?", [sid]).then(() => callback(null)).catch(callback);
    }
    touch(sid, value, callback = () => {}) {
        const expires = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 14400000;
        this.pool.execute("UPDATE sesiones SET expires_at = ? WHERE sid = ?", [expires, sid]).then(() => callback(null)).catch(callback);
    }
}
module.exports = MysqlSessionStore;
