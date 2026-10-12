"""Standalone entrypoint for running the ZenFit background RabbitMQ plan worker."""

import sys
import os

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.workers.plan_worker import run_worker

if __name__ == "__main__":
    run_worker()
