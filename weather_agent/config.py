"""Model settings loaded from environment variables."""
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    model: str = 'qwen3.5:9b'
    base_url: str = 'http://localhost:11434'
    num_ctx: int = 16384
    timeout: int = 180
    reasoning: bool = True

    @classmethod
    def from_env(cls):
        return cls(model=os.getenv('OLLAMA_MODEL', 'qwen3.5:9b'),
                   base_url=os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434'),
                   reasoning=os.getenv('OLLAMA_THINKING', 'true').strip().lower()
                   not in {'false', '0', 'no', 'off'})
