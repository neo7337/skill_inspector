.PHONY: dev backend frontend install test clean

# Start both backend and frontend in parallel
dev:
	@echo "Starting backend and frontend..."
	@(make backend &) && make frontend

# Backend only
backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# Frontend only
frontend:
	cd frontend && npm run dev

# Install all dependencies
install:
	@echo "Setting up backend..."
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
	@echo "Setting up frontend..."
	cd frontend && npm install

# Run backend tests
test:
	cd backend && PYTHONPATH=. .venv/bin/pytest tests/ -v

# Build frontend for production
build:
	cd frontend && npm run build

# Clean generated files
clean:
	cd frontend && rm -rf dist node_modules
	cd backend && rm -rf .venv __pycache__ .pytest_cache
