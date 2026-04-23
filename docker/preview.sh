#!/bin/sh
set -eu
_USER=$(id -un)
exec docker run -it --rm -u "${_USER}" \
	--name tayrax-preview \
	--hostname tayrax-preview.local \
	-v "${PWD}:/opt/tayrax/site" \
	--workdir /opt/tayrax/site \
	--entrypoint /opt/tayrax/site/docker/run/httpd.sh \
	-p 127.0.0.1:1980:1980 \
	tayrax/site
