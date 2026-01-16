/**
 * Tailscale Email Proxy Server
 * 
 * This proxy server runs on a cloud instance (DigitalOcean, AWS, etc.)
 * that is part of the Tailscale network. It forwards IMAP/SMTP requests
 * from Vercel to the Synology MailPlus Server via Tailscale.
 * 
 * Setup:
 * 1. Deploy this to a cloud server (DigitalOcean Droplet, AWS EC2, etc.)
 * 2. Install Tailscale on the server
 * 3. Connect the server to your Tailscale network
 * 4. Set environment variables:
 *    - PROXY_PORT (default: 3000)
 *    - SYNO_IMAP_HOST (Tailscale IP of Synology, e.g., 100.80.235.71)
 *    - SYNO_IMAP_PORT (default: 993)
 *    - SYNO_SMTP_HOST (Tailscale IP of Synology, e.g., 100.80.235.71)
 *    - SYNO_SMTP_PORT (default: 465)
 * 5. Expose the proxy port (3000) to the internet
 * 6. Update Vercel env vars to point to this proxy
 */

/**
 * Tailscale Email Proxy Server - TCP Proxy
 * 
 * IMAP and SMTP are TCP protocols, so we use raw TCP proxying.
 * This server listens on public ports and forwards connections
 * to Synology MailPlus Server via Tailscale network.
 */

const net = require('net');
const http = require('http');

// Synology MailPlus Server Tailscale IPs
const SYNO_IMAP_HOST = process.env.SYNO_IMAP_HOST || '100.80.235.71';
const SYNO_IMAP_PORT = parseInt(process.env.SYNO_IMAP_PORT || '993', 10);
const SYNO_SMTP_HOST = process.env.SYNO_SMTP_HOST || '100.80.235.71';
const SYNO_SMTP_PORT = parseInt(process.env.SYNO_SMTP_PORT || '465', 10);

// Public ports (exposed to internet)
const IMAP_TCP_PORT = parseInt(process.env.IMAP_TCP_PORT || '1993', 10);
const SMTP_TCP_PORT = parseInt(process.env.SMTP_TCP_PORT || '1465', 10);
const HEALTH_PORT = parseInt(process.env.HEALTH_PORT || '3000', 10);

console.log('Tailscale Email Proxy Server');
console.log('============================');
console.log(`IMAP: ${IMAP_TCP_PORT} -> ${SYNO_IMAP_HOST}:${SYNO_IMAP_PORT}`);
console.log(`SMTP: ${SMTP_TCP_PORT} -> ${SYNO_SMTP_HOST}:${SYNO_SMTP_PORT}`);
console.log(`Health: http://localhost:${HEALTH_PORT}/health`);

// TCP Proxy for IMAP (direct connection)
const imapTcpServer = net.createServer((clientSocket) => {
  console.log('[IMAP TCP] New connection');
  
  const serverSocket = net.createConnection({
    host: SYNO_IMAP_HOST,
    port: SYNO_IMAP_PORT
  }, () => {
    console.log(`[IMAP TCP] Connected to ${SYNO_IMAP_HOST}:${SYNO_IMAP_PORT}`);
  });

  clientSocket.pipe(serverSocket);
  serverSocket.pipe(clientSocket);

  clientSocket.on('error', (err) => {
    console.error('[IMAP TCP] Client error:', err.message);
    serverSocket.destroy();
  });

  serverSocket.on('error', (err) => {
    console.error('[IMAP TCP] Server error:', err.message);
    clientSocket.destroy();
  });
});

// TCP Proxy for SMTP (direct connection)
const smtpTcpServer = net.createServer((clientSocket) => {
  console.log('[SMTP TCP] New connection');
  
  const serverSocket = net.createConnection({
    host: SYNO_SMTP_HOST,
    port: SYNO_SMTP_PORT
  }, () => {
    console.log(`[SMTP TCP] Connected to ${SYNO_SMTP_HOST}:${SYNO_SMTP_PORT}`);
  });

  clientSocket.pipe(serverSocket);
  serverSocket.pipe(clientSocket);

  clientSocket.on('error', (err) => {
    console.error('[SMTP TCP] Client error:', err.message);
    serverSocket.destroy();
  });

  serverSocket.on('error', (err) => {
    console.error('[SMTP TCP] Server error:', err.message);
    clientSocket.destroy();
  });
});

// Health check HTTP server
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      imap: `${SYNO_IMAP_HOST}:${SYNO_IMAP_PORT}`,
      smtp: `${SYNO_SMTP_HOST}:${SYNO_SMTP_PORT}`,
      timestamp: new Date().toISOString()
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// Start TCP proxies
imapTcpServer.listen(IMAP_TCP_PORT, '0.0.0.0', () => {
  console.log(`✓ [IMAP TCP] Proxy listening on 0.0.0.0:${IMAP_TCP_PORT}`);
});

smtpTcpServer.listen(SMTP_TCP_PORT, '0.0.0.0', () => {
  console.log(`✓ [SMTP TCP] Proxy listening on 0.0.0.0:${SMTP_TCP_PORT}`);
});

// Start health check server
healthServer.listen(HEALTH_PORT, '0.0.0.0', () => {
  console.log(`✓ [Health] Server listening on 0.0.0.0:${HEALTH_PORT}`);
  console.log('\nProxy server is ready!');
  console.log(`Vercel should connect to:`);
  console.log(`  IMAP_SERVER=<THIS_SERVER_PUBLIC_IP>`);
  console.log(`  IMAP_PORT=${IMAP_TCP_PORT}`);
  console.log(`  SMTP_SERVER=<THIS_SERVER_PUBLIC_IP>`);
  console.log(`  SMTP_PORT=${SMTP_TCP_PORT}`);
});
