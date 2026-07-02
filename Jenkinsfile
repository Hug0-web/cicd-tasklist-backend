pipeline {
    agent any

    tools {
        nodejs 'NodeJS_20'
    }

    options {
        timestamps()
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        IMAGE_NAME = 'tasklist-backend'
        IMAGE_TAG  = "${env.BUILD_NUMBER}"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Unit tests') {
            steps {
                sh 'npm run test:coverage'
                sh 'cp reports/junit.xml reports/junit-unit.xml'
                sh 'rm -rf coverage-unit && mv coverage coverage-unit'
            }
            post {
                always {
                    junit 'reports/junit-unit.xml'
                }
            }
        }

        stage('E2E tests') {
            steps {
                sh 'npm run test:e2e:coverage'
                sh 'cp reports/junit.xml reports/junit-e2e.xml'
                sh 'rm -rf coverage-e2e && mv coverage coverage-e2e'
            }
            post {
                always {
                    junit 'reports/junit-e2e.xml'
                }
            }
        }

        stage('SonarQube analysis') {
            steps {
                withSonarQubeEnv(installationName: 'SonarQube', credentialsId: 'sonarcloud-token-backend') {
                    sh 'npx sonar-scanner'
                }
            }
        }

        stage('Quality Gate') {
            steps {
                timeout(time: 5, unit: 'MINUTES') {
                    waitForQualityGate abortPipeline: true
                }
            }
        }

        stage('Docker build') {
            steps {
                sh "docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest ."
            }
        }

        stage('Deploy (local Docker)') {
            when {
                branch 'main'
            }
            steps {
                sh """
                    docker stop tasklist-backend || true
                    docker rm tasklist-backend || true
                    docker run -d --name tasklist-backend --restart unless-stopped \
                        -p 3001:3001 --env-file "\$WORKSPACE/.env" \
                        ${IMAGE_NAME}:latest
                """
            }
        }
    }

    post {
        always {
            archiveArtifacts artifacts: 'coverage-unit/**, coverage-e2e/**', allowEmptyArchive: true
            cleanWs()
        }
    }
}
