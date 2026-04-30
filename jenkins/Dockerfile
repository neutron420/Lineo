FROM jenkins/jenkins:lts-jdk17

USER root

# Install Docker CLI
RUN apt-get update && apt-get install -y lsb-release && \
    curl -fsSLo /usr/share/keyrings/docker-archive-keyring.asc \
    https://download.docker.com/linux/debian/gpg && \
    echo "deb [arch=$(dpkg --print-architecture) \
    signed-by=/usr/share/keyrings/docker-archive-keyring.asc] \
    https://download.docker.com/linux/debian \
    $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list && \
    apt-get update && apt-get install -y docker-ce-cli

# Install Go (for Backend CI)
RUN curl -OL https://go.dev/dl/go1.25.0.linux-amd64.tar.gz && \
    tar -C /usr/local -xzf go1.25.0.linux-amd64.tar.gz && \
    rm go1.25.0.linux-amd64.tar.gz
ENV PATH=$PATH:/usr/local/go/bin

# Install Trivy (for Security Scanning)
RUN apt-get install -y wget gnupg && \
    wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | gpg --dearmor | tee /usr/share/keyrings/trivy.gpg > /dev/null && \
    echo "deb [signed-by=/usr/share/keyrings/trivy.gpg] https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | tee -a /etc/apt/sources.list.d/trivy.list && \
    apt-get update && apt-get install -y trivy

# Install Bun (for Frontend CI)
RUN curl -fsSL https://bun.sh/install -o install_bun.sh && \
    chmod +x install_bun.sh && \
    ./install_bun.sh && \
    rm install_bun.sh
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

USER jenkins
