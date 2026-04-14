.PHONY: docker
docker:
	@docker/build.sh

.PHONY: check
check:
	@git ls-files | grep -F .sh | xargs shellcheck
	@python3 -m py_compile upgrade.py && rm -rf __pycache__

.PHONY: ci-check
ci-check: check
	@npm ci
	@npm run check
	@npm run test

.PHONY: test
test:
	@npm run check
	@npm run test

.PHONY: clean
clean:
	@rm -rf __pycache__ dist .vite *.log

.PHONY: distclean
distclean: clean
	@rm -rf node_modules

.PHONY: dist
dist:
	@npm run build
