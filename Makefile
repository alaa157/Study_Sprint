dev:
	docker compose up --build
test:
	docker compose up -d --wait db
	docker compose run --rm -e TEST_DATABASE_URL=postgresql+psycopg://studysprint:studysprint@db:5432/studysprint_test api python -m pytest -q
seed:
	docker compose up -d --wait db
	docker compose run --rm api python seed.py