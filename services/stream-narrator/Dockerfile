FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    curl \
    wget \
    libvips \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements
COPY requirements.txt .

# Install Python packages (includes piper-tts Python library)
RUN pip install --no-cache-dir -r requirements.txt

# Note: Using piper-tts Python library instead of binary for cross-platform compatibility
# This works on both x86_64 and ARM64 (Apple Silicon) architectures

# Create voices directory
RUN mkdir -p /app/voices

# Copy voice model (will be mounted as volume)
# Volume mount: ./dependencies/voices:/app/voices

# Copy application code
COPY narrator.py vlm_processor.py tts_processor.py ./

# Create audio output directory
RUN mkdir -p /tmp/narration_audio

# Run the narrator
CMD ["python", "narrator.py"]
