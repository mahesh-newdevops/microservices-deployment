const express = require('express')
const app = express()

app.get('/notifications', (req, res) => {
  res.json({
    service: 'notification-service',
    status: 'running'
  })
})

app.listen(3000, () => {
  console.log('Notification Service Running')
})