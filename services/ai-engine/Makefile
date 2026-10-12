.PHONY: run worker test lint build clean

run:
	uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

worker:
	python worker.py

test:
	pytest -v

lint:
	python -m py_compile app/main.py worker.py

build:
	docker build -t zenfit/ai-engine:latest .

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
