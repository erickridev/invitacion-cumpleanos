const { createHash, timingSafeEqual } = require("node:crypto");
function secretMatches(provided, expected) {
    if (typeof provided !== "string" || typeof expected !== "string") return false;
    const hash = value => createHash("sha256").update(value).digest();
    return timingSafeEqual(hash(provided), hash(expected));
}
module.exports = { secretMatches };
