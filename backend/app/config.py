from __future__ import annotations
import json
import os
from pathlib import Path
from typing import Optional, Dict
from pydantic import BaseModel, Field

CONFIG_DIR = Path.home() / ".skill-inspector"
CONFIG_FILE = CONFIG_DIR / "config.json"

class LLMConfig(BaseModel):
    default_provider: str = "ollama"
    default_model: str = "llama3.1:latest"
    api_keys: Dict[str, str] = Field(default_factory=dict)
    ollama_base_url: str = "http://localhost:11434"

class ValidationConfig(BaseModel):
    base_dir: Optional[str] = None

class ProfilerConfig(BaseModel):
    default_baseline_steps: Optional[int | str] = None

class ScenarioConfig(BaseModel):
    default_format: str = "json"
    default_count: int = 12

class CLIConfig(BaseModel):
    llm: LLMConfig = Field(default_factory=LLMConfig)
    validation: ValidationConfig = Field(default_factory=ValidationConfig)
    profiler: ProfilerConfig = Field(default_factory=ProfilerConfig)
    scenarios: ScenarioConfig = Field(default_factory=ScenarioConfig)

def load_config(custom_path: Optional[Path] = None) -> CLIConfig:
    config_path = custom_path or CONFIG_FILE
    if not config_path.exists():
        return CLIConfig()
    
    try:
        data = json.loads(config_path.read_text(encoding="utf-8"))
        return CLIConfig.model_validate(data)
    except Exception:
        # fallback gracefully if corrupted
        return CLIConfig()
    
def init_default_config(overwrite: bool = False) -> Path:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if not CONFIG_FILE.exists() or overwrite:
        default_cfg = CLIConfig()
        CONFIG_FILE.write_text(default_cfg.model_dump_json(indent=2), encoding="utf-8")
        # Restrict permissions since config might hold API keyss
        os.chmod(CONFIG_FILE, 0o600)  # owner r/w only
    return CONFIG_FILE
    