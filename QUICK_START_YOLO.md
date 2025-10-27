# 🚀 Quick Start: YOLO Object Detection

## ⚡ Get Started in 3 Minutes

### Step 1: Add YOLO Model (1 minute)

```bash
# Install ultralytics
pip3 install ultralytics

# Navigate to models directory
cd /Users/nadavshanun/Downloads/cloud-obs-main/frontend/public/models

# Export and rename in one command
python3 << 'EOF'
from ultralytics import YOLO
model = YOLO('yolo11n.pt')
model.export(format='onnx', imgsz=256, simplify=True)
import os
os.rename('yolo11n.onnx', 'yolo11n_256.onnx')
print("✅ Model ready at: yolo11n_256.onnx")
EOF
```

### Step 2: Start Development Server (30 seconds)

```bash
cd /Users/nadavshanun/Downloads/cloud-obs-main/frontend
pnpm dev
```

### Step 3: Test YOLO Detection (1 minute)

1. Open browser: http://localhost:3000
2. Create or join a room
3. Click **"View"** in the sidebar (hamburger menu)
4. Enable your camera (or add external streams)
5. You should see:
   - ✅ **Green "YOLO Active"** badge
   - ✅ **Bounding boxes** around detected objects
   - ✅ **Detection counts** (👤 persons, 🚗 vehicles)
   - ✅ **Performance metrics** (FPS, inference time)

---

## 🎯 Expected Results

### What You Should See:

```
┌─────────────────────────────────────────┐
│ 🎯 YOLO Object Detection + AI Ranking  │
│                                         │
│ ● YOLO Active  ● AI Ranking Active     │
│                                         │
│ [Detections Only] [Ranked] [Combined]  │
│                                         │
│ 3 participants • 3 videos • 12 objects │
│ • 👤 5 • 🚗 3                           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🏆 Top Ranked                           │
│ ┌─────────────────────────────────────┐ │
│ │ [Video with bounding boxes]         │ │
│ │ 👤 2  📦 3      25.3 FPS  38ms      │ │
│ └─────────────────────────────────────┘ │
│ Camera 1                                │
│ 👤 2 person(s) 📦 3 other              │
│ AI Score: 87% • Updated 12:34:56 PM    │
└─────────────────────────────────────────┘
```

### Performance Targets:

| Metric | Expected | Good | Needs Tuning |
|--------|----------|------|--------------|
| FPS | 20-30 | 15-20 | <15 |
| Inference Time | 30-50ms | 50-80ms | >80ms |
| Detections | Varies | Any | None (check camera) |

---

## ❌ Troubleshooting

### Issue: "YOLO Offline" (Red Badge)

**Quick Fixes:**

```bash
# 1. Check model exists
ls -lh /Users/nadavshanun/Downloads/cloud-obs-main/frontend/public/models/*.onnx

# 2. Verify filename
# Should output: yolo11n_256.onnx (exactly, case-sensitive)

# 3. Check file size
# Should be 5-7 MB, NOT <1 MB (that means HTML error page)

# 4. Restart dev server
# Ctrl+C to stop, then: pnpm dev
```

### Issue: Low FPS (<15)

**Quick Fixes:**

1. **Reduce processing frequency:**
   - Edit `/frontend/lib/YOLOView.tsx` line 118
   - Change `setInterval(processFrame, 100)` to `setInterval(processFrame, 200)`
   - This reduces to 5 FPS processing (less CPU usage)

2. **Use smaller input size:**
   - Already using 256x256 (optimal)
   - Don't change unless you need higher accuracy

3. **Close other apps:**
   - Close Chrome tabs
   - Close heavy applications

### Issue: No Bounding Boxes Visible

**Quick Checks:**

1. **Toggle is enabled:**
   - Check "Show YOLO Boxes" is ON (in View controls)

2. **Objects in frame:**
   - Point camera at people, cars, or common objects
   - YOLO detects 80 COCO classes (see `/lib/yolo/YOLOService.ts` line 13)

3. **Confidence threshold:**
   - Default is 25% (good for most cases)
   - Lower = more detections, higher = fewer detections

---

## 🎨 Customization

### Change Model

Edit `/frontend/lib/YOLOView.tsx` line 39:

```typescript
modelPath: '/models/yolo11n_256.onnx',  // Change this
```

Available models:
- `yolo11n_256.onnx` - Nano, 256x256 (fastest, recommended)
- `yolo11n_640.onnx` - Nano, 640x640 (slower, more accurate)
- `yolo11m_256.onnx` - Medium, 256x256 (slower, better accuracy)

### Adjust Confidence Threshold

Edit `/frontend/lib/YOLOView.tsx` line 41:

```typescript
confidenceThreshold: 0.25,  // Change: 0.1 (more), 0.5 (fewer)
```

### Filter by Object Type

Edit `/frontend/lib/YOLOView.tsx` after line 105, add:

```typescript
// Only show person detections
detections = detections.filter(d => d.className === 'person');

// Or show multiple types
detections = detections.filter(d =>
  ['person', 'car', 'truck', 'bus'].includes(d.className)
);
```

---

## 📚 More Information

- **Full Documentation:** `/YOLO_IMPLEMENTATION_COMPLETE.md`
- **Model Setup Guide:** `/frontend/public/models/SETUP_INSTRUCTIONS.md`
- **Original Plan:** See chat history for comprehensive technical details

---

## ✅ Verification Checklist

Run through this before considering it complete:

```bash
# 1. Model exists
ls -lh /Users/nadavshanun/Downloads/cloud-obs-main/frontend/public/models/*.onnx
# Expected: yolo11n_256.onnx (5-7 MB)

# 2. Dependencies installed
cd /Users/nadavshanun/Downloads/cloud-obs-main/frontend
npm list onnxruntime-web ndarray ndarray-ops
# Expected: All three packages listed

# 3. Dev server starts
pnpm dev
# Expected: No errors, server starts on port 3000

# 4. YOLO loads in browser
# Open: http://localhost:3000
# Navigate to "View" section
# Expected: Green "YOLO Active" badge

# 5. Detections work
# Point camera at objects
# Expected: Bounding boxes appear, counts update
```

---

## 🎊 You're Done!

If all checks pass, your YOLO integration is fully functional!

**Next Steps:**
1. ✅ Test with multiple cameras
2. ✅ Adjust settings for your use case
3. ✅ Consider backend YOLO worker for GPU acceleration (optional)
4. ✅ Deploy to production when satisfied

**Enjoy your new object detection system!** 🚀
