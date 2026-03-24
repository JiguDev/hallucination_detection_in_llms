import yaml
from pathlib import Path

CONFIG_PATH = Path("configs/config.yaml")

def load_config():
    if not CONFIG_PATH.exists():
        return {}

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    return data or {}

config = load_config()