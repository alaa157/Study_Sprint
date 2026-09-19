dev:
	docker compose up --build
test:
	docker compose run --rm api pytest -q
seed:
	docker compose run --rm api python seed.py