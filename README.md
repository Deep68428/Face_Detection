# Multi-Camera Face Recognition System

A modular, scalable face recognition system for monitoring multiple RTSP camera streams simultaneously. Detects and logs person presence across all cameras with automatic Excel logging.

## 🎯 Features

- ✅ **Multi-Camera Support** - Add unlimited cameras via configuration
- ✅ **Real-Time Recognition** - InsightFace + FAISS for fast, accurate recognition
- ✅ **Auto-Logging** - Detections automatically logged to Excel with timestamps
- ✅ **Organized Storage** - Face images saved in date/camera/person folder structure
- ✅ **Live Display** - Separate window for each camera with real-time annotations
- ✅ **Cooldown System** - Prevents duplicate logs within configurable timeframe
- ✅ **Auto-Reconnect** - Handles camera disconnections gracefully
- ✅ **Thread-Safe** - Proper locking for concurrent camera processing
- ✅ **Modular Architecture** - Clean separation of concerns for easy maintenance

## 📁 Project Structure

```
multicam_system/
├── config/
│   ├── __init__.py
│   ├── settings.py           # Runtime configuration
│   └── template.py            # Configuration template
│
├── core/
│   ├── __init__.py
│   ├── face_recognition.py   # InsightFace + FAISS recognition
│   ├── detection_logger.py   # Excel logging logic
│   └── image_saver.py         # Image saving utilities
│
├── threads/
│   ├── __init__.py
│   ├── stream_processor.py   # Camera stream processing
│   └── display.py             # UI rendering
│
├── main.py                    # Application entry point
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Prepare Face Database

Create a folder structure with known faces:

```
Face_Database/
└── NE/                        # Your database name
    ├── john_doe/
    │   ├── photo1.jpg
    │   ├── photo2.jpg
    │   └── photo3.jpg
    ├── jane_smith/
    │   ├── photo1.jpg
    │   └── photo2.jpg
    └── ...
```

**Tips:**
- Each person gets their own folder (folder name = person name)
- Include 3-8 clear photos per person
- Photos should show face clearly with good lighting
- System automatically builds FAISS index on first run

### 3. Configure Cameras

Edit `config/settings.py`:

```python
CAMERAS = {
    "cam1": "rtsp://admin:password@192.168.1.100:554/stream1",
    "cam2": "rtsp://admin:password@192.168.1.101:554/stream1",
    "lobby": "rtsp://admin:password@192.168.1.102:554/stream1",
    # Add more cameras here...
}
```

### 4. Run the System

```bash
python main.py
```

## 📊 Output

### Excel Log

File: `Detection_Logs/detections_DD_MM_YYYY.xlsx`

| Name       | Camera | Timestamp           | Confidence | Image-Path                           |
|------------|--------|---------------------|------------|--------------------------------------|
| John Doe   | cam1   | 2024-01-15 14:23:45 | 0.872      | Face_Database/15_01_2024/cam1/...   |
| Jane Smith | lobby  | 2024-01-15 14:24:12 | 0.791      | Face_Database/15_01_2024/lobby/...  |

### Image Storage

```
Face_Database/
└── 15_01_2024/              # Date folder
    ├── cam1/
    │   ├── John_Doe/
    │   │   └── John_Doe_cam1_142345_123_conf0.87.jpg
    │   └── Unknown/
    │       └── Unknown_cam1_142401_456_conf0.72.jpg
    ├── cam2/
    │   └── Jane_Smith/
    │       └── Jane_Smith_cam2_142412_789_conf0.79.jpg
    └── lobby/
        └── ...
```

## ⚙️ Configuration

### Key Settings (`config/settings.py`)

```python
# Recognition
SIMILARITY_THRESHOLD = 0.45      # Higher = stricter (0.0-1.0)
COOLDOWN_SECONDS = 10            # Min time between logs for same person

# Display
SHOW_WINDOWS = True              # Set False for headless mode
DISPLAY_DURATION = 3.0           # Seconds to show recent detections

# Performance
PROCESS_EVERY_N_FRAMES = 3       # Process every Nth frame (higher = faster)

# Storage
SAVE_DETECTED_FACES = True       # Save cropped face images
MIN_CONFIDENCE_TO_SAVE = 0.7     # Min confidence to save unknowns
```

## 🎮 Controls

### Keyboard (in any camera window)

- **Q** - Quit application
- **S** - Save snapshot of all cameras
- **ESC** - Quit application

## 🔧 Advanced Usage

### Adding More Cameras

Simply add entries to `CAMERAS` dict:

```python
CAMERAS = {
    "entrance": "rtsp://...",
    "exit": "rtsp://...",
    "parking": "rtsp://...",
    "lobby": "rtsp://...",
    # No limit!
}
```

Each camera automatically gets:
- Dedicated processing thread
- Separate display window
- Independent logging
- Own cooldown tracking

### Headless Mode (No Display)

```python
SHOW_WINDOWS = False
```

Perfect for:
- Server deployments
- Low-resource systems
- Background logging

### Adjusting Recognition Accuracy

**Higher Accuracy (fewer false positives):**
```python
SIMILARITY_THRESHOLD = 0.55
```

**Higher Recall (more detections):**
```python
SIMILARITY_THRESHOLD = 0.40
```

### Processing Speed vs Accuracy

**Faster (more CPU efficient):**
```python
PROCESS_EVERY_N_FRAMES = 5  # Process every 5th frame
```

**More Accurate (detects more):**
```python
PROCESS_EVERY_N_FRAMES = 1  # Process every frame
```

## 📈 Performance

### Benchmarks

| Cameras | CPU (i5) | GPU (RTX 3060) | RAM   |
|---------|----------|----------------|-------|
| 3       | ~40%     | ~15%           | ~2GB  |
| 5       | ~65%     | ~25%           | ~3GB  |
| 10      | ~90%     | ~45%           | ~5GB  |

**Tips for 10+ cameras:**
- Use GPU acceleration (CUDA)
- Increase `PROCESS_EVERY_N_FRAMES`
- Run headless (disable windows)
- Use lower resolution streams

## 🛠️ Troubleshooting

### Camera Connection Issues

**Problem:** Camera won't connect

**Solutions:**
1. Test RTSP URL in VLC: `vlc rtsp://...`
2. Check network: `ping <camera-ip>`
3. Verify credentials
4. Try different stream paths: `/h264`, `/live`, `/stream1`

### Low Recognition Accuracy

**Problem:** Not recognizing known people

**Solutions:**
1. Add more training photos (3-8 per person)
2. Lower `SIMILARITY_THRESHOLD` (0.40-0.45)
3. Ensure good lighting in training photos
4. Delete cache files and rebuild:
   ```bash
   rm Face_Database/NE/face_index_all_embeddings.faiss
   rm Face_Database/NE/face_metadata_all_embeddings.pkl
   python main.py  # Rebuilds automatically
   ```

### High CPU Usage

**Solutions:**
1. Increase `PROCESS_EVERY_N_FRAMES` to 5-10
2. Reduce number of cameras
3. Enable GPU acceleration
4. Run in headless mode

## 🔐 Security Notes

1. **Credentials:** Don't commit RTSP passwords to git
2. **Data Privacy:** Comply with local privacy laws (GDPR, etc.)
3. **Access Control:** Restrict access to log files and images
4. **Network:** Use VPN for remote camera access

## 📝 Changelog

### Version 2.0 (Current)
- Multi-camera support (unlimited cameras)
- Modular architecture
- Simplified detection logging (no punch logic)
- Per-camera windows
- Thread-safe operations

## 🤝 Support

For issues:
1. Check this README
2. Verify configuration
3. Test cameras individually
4. Check system logs

## 📄 License

MIT License - Free for personal and commercial use
