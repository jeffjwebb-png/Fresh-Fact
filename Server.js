const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'FreshFact API is live' });
});

app.listen(port, () => {
  console.log('FreshFact API is running');
});
