# 🏗️ Jenkins Setup

This folder contains the infrastructure for your CI/CD pipeline.

## 🚀 How to Run
From the **Root Directory** of the project, run:
```bash
docker-compose -f jenkins/docker-compose.yml up -d --build
```

## 🛠️ Features
- **Trivy**: Built-in security vulnerability scanner.
- **Go 1.25**: Pre-installed Go environment for backend builds.
- **Bun**: Pre-installed for lightning-fast frontend builds.
- **Docker-in-Docker**: Allows Jenkins to build and push Docker images.

## 🔑 Admin Password
To get your login password, run:
```bash
docker exec jenkins-blueocean cat /var/jenkins_home/secrets/initialAdminPassword
```
Access at: **http://localhost:9090**
