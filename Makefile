.PHONY: docker
docker:
	@docker/build.sh

.PHONY: check
check:
	@shellcheck docker/*.sh
	@python3 -m py_compile upgrade.py && rm -rf __pycache__
