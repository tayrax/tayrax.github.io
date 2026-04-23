#!/bin/sh
set -eu
_USER=$(id -un)
exec docker run -it --rm -u "${_USER}" \
	--name tayrax-devel \
	--hostname tayrax-devel.local \
	-v "${PWD}:/opt/tayrax/site" \
	--workdir /opt/tayrax/site \
	--entrypoint /opt/tayrax/site/docker/run/devel.sh \
	-p 127.0.0.1:5173:5173 \
	tayrax/site
