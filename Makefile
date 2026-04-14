.PHONY: docker
docker:
	@docker/build.sh

.PHONY: check
check:
	@shellcheck devel.sh docker/*.sh
	@python3 -m py_compile upgrade.py && rm -rf __pycache__

.PHONY: ci-check
ci-check: check
	@npm ci
	@npm run check
	@npm run build

.PHONY: clean
clean:
	@rm -rf __pycache__ dist .vite *.log

.PHONY: distclean
distclean: clean
	@rm -rf node_modules
