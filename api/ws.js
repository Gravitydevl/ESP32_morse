import { Server } from "ws";

let wsServer;

export default function handler(req, res) {
  if (!res.socket.server.ws) {
    console.log("Запуск WebSocket сервера...");
    const wss = new Server({ server: res.socket.server });

    wss.on("connection", socket => {
      console.log("Клиент подключился");

      socket.on("message", msg => {
        // Отправляем полученное всем клиентам
        wss.clients.forEach(client => {
          if (client.readyState === 1) client.send(msg);
        });
      });
    });

    res.socket.server.ws = wss;
  }
  res.end();
}
