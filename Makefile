.PHONY: dev down build logs ps

dev: down
	@fuser -k 4000/tcp 2>/dev/null || true
	@fuser -k 3000/tcp 2>/dev/null || true
	DOCKER_BUILDKIT=1 docker compose up -d

build:
	DOCKER_BUILDKIT=1 docker compose build

rebuild: down
	@fuser -k 4000/tcp 2>/dev/null || true
	@fuser -k 3000/tcp 2>/dev/null || true
	DOCKER_BUILDKIT=1 docker compose build
	DOCKER_BUILDKIT=1 docker compose up -d

down:
	docker compose down --remove-orphans

logs:
	docker compose logs -f

ps:
	docker compose ps
