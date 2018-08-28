FROM alpine:3.7

ENV MOCHA_TAGS not:flaky
ENV LANG C.UTF-8

# ADD https://nodejs.org/dist/v6.14.4/node-v6.14.4-linux-x64.tar.gz /tmp/
# RUN tar xzf /tmp/node-v6.14.4-linux-x64.tar.gz -C /usr/local/ && rm /tmp/node-v6.14.4-linux-x64.tar.gz

# Install dependencies
RUN apk add -U \
    nodejs \
    npm \
    python3 \
    gcc \
    libffi-dev \
    python3-dev \
    musl-dev \
    openssl-dev && \
    mkdir -p /usr/local/bin/tests/node_tests

# COPY ./node_tests/package.json ./node_tests/package-lock.json /usr/local/bin/tests/node_tests/
# COPY ./python_tests/requirements.txt /tmp

# RUN python3 -m pip install -r /tmp/requirements.txt tox kubernetes && \
#     cd /usr/local/bin/tests/node_tests && \
#     npm install && \
#     rm -rf /var/cache/apk/* && \
#     npm cache clear && \
#     rm -rf ~/.node-gyp && \
#     rm -rf /tmp/npm-* && \
#     rm -rf /var/cache/apk/*

# COPY ./node_tests/npm_chain.sh ./docker-entrypoint.sh /usr/local/bin/
# RUN chmod +x /usr/local/bin/npm_chain.sh /usr/local/bin/docker-entrypoint.sh

# # Copy Tests
# COPY . /usr/local/bin/tests/

# WORKDIR /usr/local/bin/tests

# CMD [ "docker-entrypoint.sh" ]
