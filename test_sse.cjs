const EventSource = require('eventsource');

const email = 'bbard7081@gmail.com';
const url = `http://localhost:3000/api/telephony/events?email=${encodeURIComponent(email)}`;

console.log(`🔌 Connecting to SSE: ${url}`);
const es = new EventSource(url);

es.onopen = () => {
    console.log('✅ SSE Connection Opened');
};

es.onmessage = (event) => {
    console.log('📩 RECEIVED MESSAGE:', event.data);
};

es.onerror = (err) => {
    console.error('❌ SSE Error:', err);
};

// Keep alive for 15 seconds then exit
setTimeout(() => {
    console.log('Test complete, closing connection.');
    es.close();
}, 15000);
