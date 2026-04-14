.PHONY: docker
docker:
	@docker/build.sh

.PHONY: check
check:
	@shellcheck docker/*.sh
	@python3 -m py_compile upgrade.py && rm -rf __pycache__

.PHONY: clean
clean:
	@rm -rf __pycache__ dist .vite *.log

.PHONY: distclean
distclean: clean
	@rm -rf node_modules
