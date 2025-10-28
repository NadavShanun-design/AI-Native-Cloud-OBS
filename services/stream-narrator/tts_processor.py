"""
TTS Processor using Piper TTS
Converts text descriptions to natural speech audio
"""

import wave
import uuid
import os
import logging
import time
from pathlib import Path

logger = logging.getLogger(__name__)


class TTSProcessor:
    """Text-to-Speech processor using Piper Python library"""

    def __init__(self):
        self.voice_model_path = os.getenv('TTS_VOICE_MODEL', '/app/voices/en_US-lessac-medium.onnx')
        self.audio_output_dir = os.getenv('AUDIO_OUTPUT_DIR', '/tmp/narration_audio')

        # Create output directory
        os.makedirs(self.audio_output_dir, exist_ok=True)

        # Verify voice model exists
        if not os.path.exists(self.voice_model_path):
            raise FileNotFoundError(f"Voice model not found at {self.voice_model_path}")

        # Load Piper voice model (Python API)
        try:
            from piper.voice import PiperVoice
            logger.info("📦 Loading Piper TTS voice model...")
            self.voice = PiperVoice.load(self.voice_model_path)
            logger.info("✅ TTS Processor initialized (Python API)")
            logger.info(f"   Voice model: {self.voice_model_path}")
            logger.info(f"   Sample rate: {self.voice.config.sample_rate} Hz")
            logger.info(f"   Output directory: {self.audio_output_dir}")
        except ImportError:
            logger.error("❌ piper-tts package not installed. Install with: pip install piper-tts")
            raise
        except Exception as e:
            logger.error(f"❌ Failed to load Piper voice: {e}")
            raise

    async def synthesize(self, text: str) -> str:
        """
        Convert text to speech and save as WAV file using Piper Python API

        Args:
            text: Text to convert to speech

        Returns:
            Filename of generated audio file (not full path)
        """
        start_time = time.time()

        try:
            # Generate unique filename
            audio_id = str(uuid.uuid4())
            audio_filename = f"narration_{audio_id}.wav"
            audio_path = os.path.join(self.audio_output_dir, audio_filename)

            logger.info(f"🎙️ Synthesizing speech: {text[:50]}...")

            # Use Piper Python API to synthesize speech
            with wave.open(audio_path, 'wb') as wav_file:
                # Configure WAV file
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(self.voice.config.sample_rate)

                # Synthesize and write to file
                self.voice.synthesize(text, wav_file)

            # Verify file was created
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio file was not created: {audio_path}")

            file_size = os.path.getsize(audio_path)
            elapsed = time.time() - start_time

            logger.info(f"✅ Audio generated: {audio_filename} ({file_size} bytes) in {elapsed:.2f}s")

            return audio_filename

        except Exception as e:
            logger.error(f"❌ TTS error: {e}")
            raise

    def cleanup_old_files(self, max_age_seconds=300):
        """
        Delete audio files older than max_age_seconds

        Args:
            max_age_seconds: Maximum age of files to keep (default: 5 minutes)
        """
        try:
            now = time.time()
            deleted_count = 0

            for filename in os.listdir(self.audio_output_dir):
                if not filename.startswith('narration_'):
                    continue

                filepath = os.path.join(self.audio_output_dir, filename)
                file_age = now - os.path.getmtime(filepath)

                if file_age > max_age_seconds:
                    os.remove(filepath)
                    deleted_count += 1

            if deleted_count > 0:
                logger.info(f"🧹 Cleaned up {deleted_count} old audio files")

        except Exception as e:
            logger.error(f"❌ Cleanup error: {e}")
