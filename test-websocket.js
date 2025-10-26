const WebSocket = require('ws');

console.log('🔌 Connecting to WebSocket at ws://localhost:3000/ws...');

const ws = new WebSocket('ws://localhost:3000/ws');

ws.on('open', function open() {
  console.log('✅ Connected to WebSocket!');
  console.log('📡 Listening for score updates...\n');
});

ws.on('message', function incoming(data) {
  try {
    const message = JSON.parse(data);
    console.log('📊 Received message:', JSON.stringify(message, null, 2));
  } catch (e) {
    console.log('Raw message:', data.toString());
  }
});

ws.on('close', function close() {
  console.log('❌ WebSocket connection closed');
});

ws.on('error', function error(err) {
  console.error('❌ WebSocket error:', err.message);
});

// Keep alive for 30 seconds
setTimeout(() => {
  console.log('\n⏱️  Test complete. Closing connection...');
  ws.close();
  process.exit(0);
}, 30000);
