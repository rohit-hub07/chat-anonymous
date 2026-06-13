import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import { createClient } from 'redis'
import { channel } from 'diagnostics_channel'
import dotenv from "dotenv"
dotenv.config()
import { fileURLToPath } from 'url'
import path from "path";


const app = express()

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); 

app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app)
const io = new Server(server, {
  cors: { origin: "*" }
})

const pubClient = createClient({ url: process.env.REDIS_URL })
const subClient = pubClient.duplicate()

async function initRedis() {
  await pubClient.connect();
  await subClient.connect()
  console.log("Connected to redis server")

  await subClient.pSubscribe('room:*', (message, channel) => {
    const parsedMessaged = JSON.parse(message)
    const roomId = channel.split(':')[1]

    io.to(roomId).emit("recieved message: ", parsedMessaged)
  })
}

initRedis().catch(console.error)

io.on('connection', (socket) => {
  console.log(`User connected: ${socket}`)

  socket.on('join_room', (roomId) => {
    socket.join(roomId)
    console.log(`User ${socket.id} joined room: ${roomId}`)
  })

  socket.on('send_message', async (data) => {
    const { room, user, message } = data
    const payload = {
      user,
      message,
      timestamp: new Date().toISOString()
    }
    await pubClient.publish(`room:${room}`, JSON.stringify(payload))
    io.to(room).emit("receive_message", payload)
  })

  // socket.on("receive_message")

  socket.on('disconnet', () => {
    console.log(`User disconnected: ${socket.id}`)
  })

})

server.listen(3000, () => {
  console.log("Listening")
})
