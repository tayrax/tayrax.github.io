FROM debian:forky-20260406-slim

LABEL maintainer="Jeremías Casteglione <jrmsdev@gmail.com>"
LABEL version="260414"

ENV TAYRAX_UPGRADE=260414

USER root:root
WORKDIR /root

ENV USER=root
ENV HOME=/root

ENV DEBIAN_FRONTEND=noninteractive

COPY ./apt.install /tmp/apt.install

RUN apt-get clean \
	&& apt-get update -yy \
	&& apt-get dist-upgrade -yy --purge \
	&& cat /tmp/apt.install | xargs apt-get install -yy --no-install-recommends \
	&& apt-get clean \
	&& apt-get autoremove -yy --purge \
	&& rm -rf /var/lib/apt/lists/* \
		/var/cache/apt/archives/*.deb \
		/var/cache/apt/*cache.bin \
		/tmp/apt.install

ARG DEVEL_UID=1000
ARG DEVEL_GID=1000

ENV DEVEL_UID=${DEVEL_UID}
ENV DEVEL_GID=${DEVEL_GID}

RUN groupadd -o -g ${DEVEL_GID} devel \
	&& useradd -o -d /home/devel -m -c 'devel' -g ${DEVEL_GID} -u ${DEVEL_UID} devel \
	&& chmod -v 0750 /home/devel

RUN printf 'umask %s\n' '027' >>/home/devel/.profile

COPY ./user-login.sh /usr/local/bin/user-login.sh
RUN chmod -v 0755 /usr/local/bin/user-login.sh

RUN install -v -m 0750 -o devel -g devel -d /opt/tayrax \
	&& install -v -m 0750 -o devel -g devel -d /opt/tayrax/site

RUN ln -vsf /home/devel/.local/npm/node_modules/.bin/claude /usr/local/bin/claude

USER devel:devel
WORKDIR /home/devel

ENV USER=devel
ENV HOME=/home/devel

RUN npm version
RUN npx --version

ENV TAYRAX_CLAUDE_UPGRADE=2.1.107

RUN install -v -d -m 0750 ${HOME}/.local/npm \
	&& cd ${HOME}/.local/npm \
	&& npm install @anthropic-ai/claude-code
RUN /usr/local/bin/claude --version

ENTRYPOINT ["/usr/local/bin/user-login.sh"]
