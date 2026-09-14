VENV ?= .venv
PY := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

.PHONY: install run migrations migrate superuser test lint format shell check clean

install: ## create venv + install dev dependencies
	python3 -m venv $(VENV)
	$(PIP) install -q --upgrade pip
	$(PIP) install -q -r requirements/dev.txt
	@echo "done. next: make migrate && make run"

run: ## dev server on :8000
	$(PY) manage.py runserver 0.0.0.0:8000

migrations: ## create migrations after changing models
	$(PY) manage.py makemigrations

migrate: ## apply migrations
	$(PY) manage.py migrate

superuser: ## create an admin login for /admin/
	$(PY) manage.py createsuperuser

test: ## run the test suite
	$(VENV)/bin/pytest

lint: ## ruff check
	$(VENV)/bin/ruff check .

format: ## ruff format + autofix
	$(VENV)/bin/ruff format .
	$(VENV)/bin/ruff check --fix .

check: ## django's own deployment checks
	$(PY) manage.py check --deploy --settings=config.settings.prod

shell: ## django shell
	$(PY) manage.py shell

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
