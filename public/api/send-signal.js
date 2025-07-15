export default async function handler(req, res) {
  if (req.method === 'POST') {
    const Pusher = require('pusher');
    
    const pusher = new Pusher({
      appId: '2022942',
      key: '30ec539f3967eb652483',
      secret: '9c439cace3141db356ee',
      cluster: 'eu',
      useTLS: true
    });
    
    const { channel, signalType, frequency, senderId } = req.body;
    
    try {
      await pusher.trigger(`private-morse-${channel}`, 'signal', {
        signalType,
        frequency,
        channel,
        senderId
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to send signal' });
    }
  } else {
    res.status(405).end(); // Method Not Allowed
  }
}