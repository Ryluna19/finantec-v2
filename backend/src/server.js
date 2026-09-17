import express from 'express'

const app = express()
const port = 3000

app.get('/health', (request, response) => {
  response.json({
    status: 'ok',
  })
})

app.listen(port, () => {
  console.log(`FinanTec API running on http://localhost:${port}`)
})