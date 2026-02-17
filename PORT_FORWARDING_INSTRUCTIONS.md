# Port Forwarding Instructions

To host directly from your laptop (No tunneling, max speed), you need to tell your router to send internet traffic to your laptop.

## Step 1: Firewall (One-Time)
**Right-click** the `allow-port.bat` file I created and select **Run as Administrator**.
This opens port 3000 on your laptop so it accepts connections.

## Step 2: Router Configuration
1. Open your browser and go to your Router's page:
   **[http://192.168.100.1](http://192.168.100.1)**
   *(Username/Password is usually on the sticker on the back of the router)*

2. Look for a setting called **"Port Forwarding"**, "NAT", "Virtual Server", or "Gaming".

3. Create a **New Rule**:
   - **Name:** FrostHost
   - **Protocol:** TCP
   - **External Port:** 3000
   - **Internal Port:** 3000
   - **Target IP (Internal IP):** `192.168.100.159`
   *(This is YOUR laptop's specific address)*

4. Save/Apply settings.

## Step 3: Share Your Link
Your "Public IP" is your address on the internet.
Go to [whatismyip.com](https://www.whatismyip.com) to copy it.

**Your Link:** `http://[YOUR_PUBLIC_IP]:3000`
(Example: `http://45.12.89.123:3000`)

---
**Troubleshooting:**
- If your router asks for start/end ports, put `3000` for both.
- If the link doesn't work for your friend, check if your Public IP changed (it changes sometimes if you restart the router).
