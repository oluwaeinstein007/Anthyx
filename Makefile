.PHONY: dev down build logs ps migrate generate

dev: down
	@fuser -k 4000/tcp 2>/dev/null || true
	@fuser -k 3000/tcp 2>/dev/null || true
	@fuser -k 3001/tcp 2>/dev/null || true
	@fuser -k 3002/tcp 2>/dev/null || true
	DOCKER_BUILDKIT=1 docker compose up -d

build:
	DOCKER_BUILDKIT=1 docker compose build

rebuild: down
	@fuser -k 4000/tcp 2>/dev/null || true
	@fuser -k 3000/tcp 2>/dev/null || true
	@fuser -k 3001/tcp 2>/dev/null || true
	@fuser -k 3002/tcp 2>/dev/null || true
	DOCKER_BUILDKIT=1 docker compose build
	DOCKER_BUILDKIT=1 docker compose up -d

down:
	docker compose down --remove-orphans

logs:
	docker compose logs -f

ps:
	docker compose ps

migrate:
	cd api && npx drizzle-kit migrate

generate:
	cd api && npx drizzle-kit generate
