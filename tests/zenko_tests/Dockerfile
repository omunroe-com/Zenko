FROM node:6-alpine

ENV MOCHA_TAGS not:flaky

# Install dependencies
RUN apk add -U python3 \
    gcc \
    libffi-dev \
    python3-dev \
    musl-dev \
    openssl-dev && \
    mkdir -p /usr/local/bin/tests

COPY ./node_tests/package.json ./node_tests/package-lock.json ./python_tests/requirements.txt /tmp/

RUN cd /tmp && \
    python3 -m pip install -r requirements.txt && \
    python3 -m pip install tox kubernetes && \
    npm install -g && \
    rm -rf /var/cache/apk/* && \
    npm cache clear && \
    rm -rf ~/.node-gyp && \
    rm -rf /tmp/npm-* && \
    rm -rf /var/cache/apk/*

COPY ./node_tests/npm_chain.sh ./docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/npm_chain.sh /usr/local/bin/docker-entrypoint.sh

# Copy Tests
COPY . /usr/local/bin/tests/

WORKDIR /usr/local/bin/tests

CMD [ "docker-entrypoint.sh" ]
