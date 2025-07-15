export default function handler(req, res) {
  if (req.method === 'POST') {
    const Pusher = require('pusher');
    
    const pusher = new Pusher({
      appId: 'YOUR_APP_ID',
      key: '7a7fdb60bf55d8ff0dbb',
      secret: 'YOUR_SECRET_KEY',
      cluster: 'eu',
      useTLS: true
    });
    
    const { socket_id, channel_name } = req.body;
    const auth = pusher.authenticate(socket_id, channel_name);
    
    res.status(200).json(auth);
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}