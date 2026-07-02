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
        DOCKERHUB_NAMESPACE = 'hugolucas529'
        IMAGE_NAME          = 'tasklist-backend'
        IMAGE_TAG           = "${env.BUILD_NUMBER}"
        FULL_IMAGE          = "${DOCKERHUB_NAMESPACE}/${IMAGE_NAME}"
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
                sh 'docker build -t $FULL_IMAGE:$IMAGE_TAG -t $FULL_IMAGE:latest .'
            }
        }

        stage('Trivy security scan') {
            steps {
                sh '''
                    mkdir -p reports/trivy
                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v trivy-cache:/root/.cache/ \
                        -v "$WORKSPACE/reports/trivy:/reports" \
                        aquasec/trivy image \
                        --format table \
                        --severity CRITICAL,HIGH \
                        --exit-code 0 \
                        -o /reports/trivy-report-backend.txt \
                        $FULL_IMAGE:$IMAGE_TAG
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/trivy/*.txt', allowEmptyArchive: true
                }
            }
        }

        stage('SBOM generation (SPDX)') {
            steps {
                sh '''
                    mkdir -p reports/sbom
                    docker run --rm \
                        -v /var/run/docker.sock:/var/run/docker.sock \
                        -v trivy-cache:/root/.cache/ \
                        -v "$WORKSPACE/reports/sbom:/reports" \
                        aquasec/trivy image \
                        --format spdx-json \
                        -o /reports/sbom-backend.spdx.json \
                        $FULL_IMAGE:$IMAGE_TAG
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'reports/sbom/*.json', allowEmptyArchive: true
                }
            }
        }

        stage('Docker push (Docker Hub)') {
            steps {
                withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
                    sh '''
                        echo "$DOCKERHUB_PASS" | docker login -u "$DOCKERHUB_USER" --password-stdin
                        docker push $FULL_IMAGE:$IMAGE_TAG
                        docker push $FULL_IMAGE:latest
                        docker logout
                    '''
                }
            }
        }

        stage('Deploy (local Docker)') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    docker stop tasklist-backend || true
                    docker rm tasklist-backend || true
                    docker run -d --name tasklist-backend --restart unless-stopped \
                        -p 3001:3001 --env-file "$WORKSPACE/.env" \
                        $FULL_IMAGE:latest
                '''
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
