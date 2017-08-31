properties([
    parameters([
        string(
            name: 'DOCKER_PREFIX',
            defaultValue: 'haufelexware/wicked.',
            description: 'Docker image prefix to use when testing.',
            required: false
        )
    ]),
    pipelineTriggers([
        [$class: "SCMTrigger", scmpoll_spec: "H/10 * * * *"],
        [$class: 'jenkins.triggers.ReverseBuildTrigger', upstreamProjects: 
            "wicked.portal/" + env.BRANCH_NAME.replaceAll("/", "%2F") + "," +
            "wicked.portal-api/" + env.BRANCH_NAME.replaceAll("/", "%2F") + "," +
            "wicked.portal-kong-adapter/" + env.BRANCH_NAME.replaceAll("/", "%2F") + "," +
            "wicked.kong/" + env.BRANCH_NAME.replaceAll("/", "%2F"),
            threshold: hudson.model.Result.SUCCESS]
    ])
])

node('docker') {

    stage('Checkout') {
        checkout scm
    }

    def dockerTag = env.BRANCH_NAME.replaceAll('/', '-')

    echo 'Using docker tag:    ' + dockerTag
    env.DOCKER_TAG = dockerTag
    echo 'Using docker prefix: ' + params.DOCKER_PREFIX
    env.DOCKER_PREFIX = params.DOCKER_PREFIX

    stage('API Tests') {

        sh './run-api-tests.sh'

    }

    stage('Portal Tests') {

        sh './run-portal-tests.sh'

    }

    stage('Kong Adapter Tests') {

        sh './run-kong-adapter-tests.sh'

    }
}