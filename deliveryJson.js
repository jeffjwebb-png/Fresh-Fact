// Browser paywalls open the successful response as a blob URL. Keep the JSON
// transport ASCII-safe so a browser choosing a legacy text encoding cannot
// corrupt Unicode symbols. JSON clients recover the exact original strings.
function serializeDelivery(value) {
  return JSON.stringify(value).replace(/[\u007f-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function sendDelivery(res, value) {
  return res.type("application/json; charset=utf-8").send(serializeDelivery(value));
}

module.exports = { serializeDelivery, sendDelivery };
