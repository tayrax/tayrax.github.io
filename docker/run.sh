#!/bin/sh
set -eu
exec docker run -it --rm -u devel \
	--name tayrax-devel \
	--hostname tayrax-devel.local \
	-v "${PWD}:/opt/tayrax/site" \
	--workdir /opt/tayrax/site \
	--entrypoint /opt/tayrax/site/devel.sh \
	-p 127.0.0.1:5173:5173 \
	tayrax/site
