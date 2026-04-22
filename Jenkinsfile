pipeline {
    agent any

    environment {
        DOCKER_HUB_USER = 'your-dockerhub-username'
        BACKEND_IMAGE = "lineo-api"
        FRONTEND_IMAGE = "lineo-fe"
        REGISTRY = "docker.io/${DOCKER_HUB_USER}"
    }

    stages {
        stage('Preparation') {
            steps {
                echo 'Checking environment...'
                sh 'docker --version'
                sh 'go version || true'
                sh 'bun --version || true'
            }
        }

        stage('Backend CI') {
            parallel {
                stage('Go Tests') {
                    steps {
                        sh 'go test ./... -v'
                    }
                }
                stage('Go Build Check') {
                    steps {
                        sh 'go build -v ./cmd/api'
                    }
                }
            }
        }

        stage('Frontend CI') {
            steps {
                dir('lineo-fe') {
                    sh 'bun install'
                    sh 'bun run lint'
                }
            }
        }

        stage('Dockerize') {
            parallel {
                stage('Build Backend Image') {
                    steps {
                        sh "docker build -t ${REGISTRY}/${BACKEND_IMAGE}:${BUILD_NUMBER} ."
                        sh "docker tag ${REGISTRY}/${BACKEND_IMAGE}:${BUILD_NUMBER} ${REGISTRY}/${BACKEND_IMAGE}:latest"
                    }
                }
                stage('Build Frontend Image') {
                    steps {
                        dir('lineo-fe') {
                            sh "docker build -t ${REGISTRY}/${FRONTEND_IMAGE}:${BUILD_NUMBER} ."
                            sh "docker tag ${REGISTRY}/${FRONTEND_IMAGE}:${BUILD_NUMBER} ${REGISTRY}/${FRONTEND_IMAGE}:latest"
                        }
                    }
                }
            }
        }

        stage('Push to Registry') {
            when {
                branch 'main'
            }
            steps {
                withCredentials([usernamePassword(credentialsId: 'docker-hub-creds', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                    sh "echo ${DOCKER_PASS} | docker login -u ${DOCKER_USER} --password-stdin"
                    sh "docker push ${REGISTRY}/${BACKEND_IMAGE}:${BUILD_NUMBER}"
                    sh "docker push ${REGISTRY}/${BACKEND_IMAGE}:latest"
                    sh "docker push ${REGISTRY}/${FRONTEND_IMAGE}:${BUILD_NUMBER}"
                    sh "docker push ${REGISTRY}/${FRONTEND_IMAGE}:latest"
                }
            }
        }
    }

    post {
        always {
            echo 'Cleaning up local images...'
            sh "docker rmi ${REGISTRY}/${BACKEND_IMAGE}:${BUILD_NUMBER} || true"
            sh "docker rmi ${REGISTRY}/${FRONTEND_IMAGE}:${BUILD_NUMBER} || true"
        }
        success {
            echo 'Build successful!'
        }
        failure {
            echo 'Build failed!'
        }
    }
}
