import os
import sys

# Add project root directory to sys.path for Vercel Serverless Function imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from backend.app.main import app

__all__ = ["app"]
