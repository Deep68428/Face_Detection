#!/bin/bash

# Ensure the script is run with sudo
if [ "$EUID" -ne 0 ]
  then echo "Please run this script with sudo: sudo bash setup_background_services.sh"
  exit
fi

echo "Creating AI Engine Service..."
cat << 'EOF' > /etc/systemd/system/ai-engine.service
[Unit]
Description=AI Engine (Machine Code) for Ethics Face Detection
After=network.target

[Service]
Type=simple
User=ethics
WorkingDirectory=/home/ethics/ethics-facedetection-ai/Machine_code
Environment="PATH=/home/ethics/ethics-facedetection-ai/.venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/home/ethics/ethics-facedetection-ai/.venv/bin/python3 main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "Creating FastAPI Backend Service..."
cat << 'EOF' > /etc/systemd/system/fastapi-backend.service
[Unit]
Description=FastAPI Backend for Ethics Face Detection
After=network.target

[Service]
Type=simple
User=ethics
WorkingDirectory=/home/ethics/ethics-facedetection-ai/backend
Environment="PATH=/home/ethics/ethics-facedetection-ai/.venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
ExecStart=/home/ethics/ethics-facedetection-ai/.venv/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling services to start automatically on boot..."
systemctl enable ai-engine.service
systemctl enable fastapi-backend.service

echo "Starting services in the background..."
systemctl restart ai-engine.service
systemctl restart fastapi-backend.service

echo ""
echo "==========================================================="
echo "✅ Setup Complete!"
echo "Your AI Engine and Backend are now running in the background."
echo "They will also automatically start whenever the server reboots."
echo ""
echo "To check the status, you can run:"
echo "  sudo systemctl status ai-engine.service"
echo "  sudo systemctl status fastapi-backend.service"
echo ""
echo "To view live logs, you can run:"
echo "  sudo journalctl -u ai-engine.service -f"
echo "  sudo journalctl -u fastapi-backend.service -f"
echo "==========================================================="
