"""
VLM Processor using Moondream2
Generates natural language descriptions of video frames
"""

import torch
import logging
import time
from PIL import Image
from transformers import AutoModelForCausalLM, AutoTokenizer

logger = logging.getLogger(__name__)


class VLMProcessor:
    """Vision Language Model processor using Moondream2"""

    def __init__(self):
        self.model_id = "vikhyatk/moondream2"
        self.revision = "2025-01-09"  # Use stable revision
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.prompt = "Describe what's happening in this scene in 1-2 clear sentences, focusing on the main action or activity."

        logger.info(f"🤖 Loading Moondream2 VLM on {self.device}...")
        logger.info(f"   Model: {self.model_id} (revision: {self.revision})")

        try:
            # Load model with specific revision for stability
            # IMPORTANT: Use float32 on CPU, float16 on GPU
            self.model = AutoModelForCausalLM.from_pretrained(
                self.model_id,
                revision=self.revision,
                trust_remote_code=True,
                device_map="auto" if self.device == "cuda" else None,
                torch_dtype=torch.float32,  # Always load as float32 first
                low_cpu_mem_usage=True
            )

            # Moondream2 uses internal tokenizer, accessed via model methods
            # No need to store tokenizer separately

            # Optimization - only convert to FP16 on GPU
            self.model.eval()
            if self.device == "cuda":
                self.model = self.model.half()  # FP16 for speed on GPU only
            else:
                # Explicitly ensure float32 on CPU
                self.model = self.model.float()

            logger.info("✅ Moondream2 VLM loaded successfully")
            if self.device == "cuda":
                logger.info(f"   GPU: {torch.cuda.get_device_name(0)}")
                logger.info(f"   VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
            else:
                logger.info("   Using CPU (slower but works)")

        except Exception as e:
            logger.error(f"❌ Failed to load VLM: {e}")
            raise

    async def describe(self, image: Image.Image) -> str:
        """
        Generate natural language description of an image

        Args:
            image: PIL Image to describe

        Returns:
            Natural language description string
        """
        start_time = time.time()

        try:
            logger.debug(f"🎨 Processing image: {image.size}")

            # Run inference
            with torch.no_grad():
                # Moondream2 specific API - uses internal tokenizer
                encoded_image = self.model.encode_image(image)
                response = self.model.answer_question(
                    encoded_image,
                    self.prompt
                )

            description = response.strip()
            elapsed = time.time() - start_time

            logger.info(f"🎯 VLM description: \"{description}\" ({elapsed:.2f}s)")

            return description

        except Exception as e:
            logger.error(f"❌ VLM inference error: {e}")
            # Return fallback description
            return "A person is visible in the video frame."
