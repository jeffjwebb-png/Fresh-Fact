function normalizePlaygroundPayment(encoded) {
  try {
    const payment = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    const accepted = payment.accepted;
    if (payment.x402Version !== 2 || !accepted) return encoded;
    // Remove only redundant client display labels; never change signed authorization.
    const checks = [
      ['maxAmountRequired', accepted.amount],
      ['name', accepted.extra?.name],
      ['version', accepted.extra?.version],
    ];
    for (const [key, value] of checks) {
      if (Object.hasOwn(accepted, key) && accepted[key] !== value) return encoded;
    }
    let changed = false;
    for (const [key] of checks) {
      if (Object.hasOwn(accepted, key)) { delete accepted[key]; changed = true; }
    }
    return changed ? Buffer.from(JSON.stringify(payment)).toString('base64') : encoded;
  } catch { return encoded; }
}
module.exports = { normalizePlaygroundPayment };
