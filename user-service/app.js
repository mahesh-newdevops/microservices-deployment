const express = require('express')
const app = express()

app.get('/', (req, res) => {
  res.json({
    service: 'user-service',
    status: 'running'
  })
})

app.listen(3000, () => {
  console.log('User Service Running')
})