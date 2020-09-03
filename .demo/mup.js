module.exports = {
    servers: {
        one: {
            host: '51.15.92.83',
            username: 'root',
            pem: '/Users/d/.ssh/id_rsa'
        }
    },
    app: {
        name: 'sse-mup',
        path: '../',
        servers: {
            one: {},
        },
        buildOptions: {
            serverOnly: true,
        },
        env: {
            ROOT_URL: 'https://sse.hup.li',
            MONGO_URL: 'mongodb://mongodb/meteor',
            MONGO_OPLOG_URL: 'mongodb://mongodb/local',
        },
        docker: {
            image: 'abernix/meteord:node-12-base'
        },
        enableUploadProgressBar: true
    },
    mongo: {
        version: '3.4.1',
        servers: {
            one: {},
        }
    },
    proxy: {
        domains: 'sse.hup.li',
        ssl: {
            forceSSL: true,
            letsEncryptEmail: 'dmandrioli@gmail.com'
        }
    }
};
