# Stunnel Setup for TLS Tunneling

Raw TCP proxy cannot forward TLS handshake properly. We need to use `stunnel` to create proper TLS tunnels.

## Installation on DigitalOcean Droplet

```bash
# SSH into your Droplet
ssh root@139.59.139.89

# Install stunnel
sudo apt update
sudo apt install -y stunnel4

# Create stunnel configuration directory
sudo mkdir -p /etc/stunnel
```

## Configuration

Create `/etc/stunnel/stunnel.conf`:

```ini
# Stunnel configuration for IMAP and SMTP TLS tunneling

# Global settings
pid = /var/run/stunnel4/stunnel4.pid
foreground = no

# IMAP tunnel: 1993 -> Synology IMAP (993)
[imap]
accept = 1993
connect = 100.80.235.71:993
client = yes
verify = 0

# SMTP tunnel: 1465 -> Synology SMTP (465)
[smtp]
accept = 1465
connect = 100.80.235.71:465
client = yes
verify = 0
```

## Enable and Start Stunnel

```bash
# Enable stunnel
sudo systemctl enable stunnel4

# Start stunnel
sudo systemctl start stunnel4

# Check status
sudo systemctl status stunnel4

# Check if ports are listening
sudo netstat -tlnp | grep stunnel
# Should show:
# tcp  0  0.0.0.0:1993  0.0.0.0:*  LISTEN  <pid>/stunnel
# tcp  0  0.0.0.0:1465  0.0.0.0:*  LISTEN  <pid>/stunnel
```

## Firewall Rules

```bash
# Allow stunnel ports
sudo ufw allow 1993/tcp
sudo ufw allow 1465/tcp
```

## Stop the Node.js Proxy

Since we're using stunnel now, we can stop the Node.js proxy:

```bash
pm2 stop email-proxy
pm2 delete email-proxy
```

## Test Connection

From your local machine or Vercel, test the connection:

```bash
# Test IMAP (should connect and show TLS handshake)
openssl s_client -connect 139.59.139.89:1993 -starttls imap

# Test SMTP (should connect and show TLS handshake)
openssl s_client -connect 139.59.139.89:1465 -starttls smtp
```

## Vercel Environment Variables

Update Vercel environment variables:

```
IMAP_SERVER=139.59.139.89
IMAP_PORT=1993
IMAP_TLS=true

SMTP_SERVER=139.59.139.89
SMTP_PORT=1465
SMTP_TLS=true
```

## Troubleshooting

If stunnel doesn't start:

```bash
# Check stunnel logs
sudo journalctl -u stunnel4 -f

# Test stunnel configuration
sudo stunnel -c /etc/stunnel/stunnel.conf -d 7
```

If connection fails:

1. Check Tailscale connectivity:
   ```bash
   ping 100.80.235.71
   ```

2. Check if Synology ports are accessible:
   ```bash
   telnet 100.80.235.71 993
   telnet 100.80.235.71 465
   ```

3. Check stunnel logs:
   ```bash
   sudo tail -f /var/log/syslog | grep stunnel
   ```
