FROM haufelexware/wicked.portal-api:dev

COPY . /tmp/test-api

RUN rm -rf /var/portal-api \
    && cp -R /tmp/test-api/test/test-config /var/portal-api
RUN mkdir -p /usr/src \
    && cp -R /tmp/test-api /usr/src/test \
    && cd /usr/src/test \
    && npm install -g mocha \
    && npm install \
    && cd /usr/src/portal-env \
    && npm install

WORKDIR /usr/src/test

CMD ["bash", "-c", "/usr/src/test/test.sh"]

EXPOSE 3003
