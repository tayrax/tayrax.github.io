#!/bin/sh
set -eu
exec docker run -it --rm -u devel \
	--name tayrax-debug \
	--hostname tayrax-debug.local \
	-v "${PWD}:/opt/tayrax/site" \
	--workdir /opt/tayrax/site \
	--entrypoint /opt/tayrax/site/docker/run/debug.sh \
	-p 127.0.0.1:1980:1980 \
	tayrax/site
