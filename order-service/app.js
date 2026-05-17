const express = require('express')
const app = express()

app.get('/orders', (req, res) => {
  res.json({
    service: 'order-service',
    status: 'running'
  })
})

app.listen(3000, () => {
  console.log('Order Service Running')
})