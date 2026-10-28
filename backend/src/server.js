import pool from './database.js'
import { createApp } from './app.js'

const app = createApp({
  database: pool,
})

const port = Number(process.env.PORT || 3000)

const server = app.listen(port, () => {
  console.log(`FinanTec API running on port ${server.address().port}`)
})
