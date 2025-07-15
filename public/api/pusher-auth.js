export default function handler(req, res) {
  if (req.method === 'POST') {
    const Pusher = require('pusher');
    
    const pusher = new Pusher({
      appId: '2022942',
      key: '30ec539f3967eb652483',
      secret: '9c439cace3141db356ee',
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