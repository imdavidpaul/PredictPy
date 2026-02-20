# predictpy — Dev shortcuts
# Usage: make <target>
# On Windows, install Make via: winget install GnuWin32.Make

.PHONY: dev backend frontend install lint format check docker-up docker-down docker-build

# ── Start ─────────────────────────────────────────────────────────────────────

## Start both backend and frontend (requires two terminals — see dev-backend / dev-frontend)
dev:
	@echo "Run these in separate terminals:"
	@echo "  make backend"
	@echo "  make frontend"

## Start FastAPI backend on :8000
backend:
	cd backend && python -m uvicorn main:app --reload --port 8000

## Start Next.js frontend on :3000
frontend:
	cd frontend && npm run dev

# ── Install ───────────────────────────────────────────────────────────────────

## Install all dependencies (backend + frontend)
install:
	cd backend && pip install --prefer-binary -r requirements.txt
	cd frontend && npm install

## Install backend deps only
install-backend:
	cd backend && pip install --prefer-binary -r requirements.txt

## Install frontend deps only
install-frontend:
	cd frontend && npm install

# ── Code Quality ──────────────────────────────────────────────────────────────

## Lint backend (ruff) + frontend (eslint)
lint:
	cd backend && ruff check .
	cd frontend && npm run lint

## Format backend (ruff) + frontend (prettier)
format:
	cd backend && ruff format .
	cd frontend && npx prettier --write .

## Type-check frontend
check:
	cd frontend && npx tsc --noEmit

## Production build (frontend)
build:
	cd frontend && npm run build

# ── Docker ────────────────────────────────────────────────────────────────────

## Build and start all services via docker-compose
docker-up:
	docker-compose up -d --build

## Stop all docker services
docker-down:
	docker-compose down

## Build docker images without starting containers
docker-build:
	docker-compose build
