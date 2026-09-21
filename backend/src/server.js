import pool from './database.js'
import { createApp } from './app.js'

const app = createApp({
  database: pool,
})

const port = 3000

app.listen(port, () => {
  console.log(`FinanTec API running on http://localhost:${port}`)
})