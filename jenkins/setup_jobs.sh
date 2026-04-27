#!/bin/bash

# Lineo Jenkins Job Setup Script
# Run this from the root directory: ./jenkins/setup_jobs.sh

JENKINS_URL="http://localhost:9090"
CLI_JAR="jenkins/jenkins-cli.jar"

echo "Starting Lineo CI/CD Automation..."

# 1. Download the CLI if it doesn't exist
if [ ! -f "$CLI_JAR" ]; then
    echo "Downloading Jenkins CLI..."
    curl -s "${JENKINS_URL}/jnlpJars/jenkins-cli.jar" -o "$CLI_JAR"
fi

# 2. Create the Job XML configuration
cat <<EOF > jenkins/job_config.xml
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <actions/>
  <description>Lineo Master CI/CD Pipeline - Automated by Senior DevOps Script</description>
  <keepDependencies>false</keepDependencies>
  <properties/>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-scm">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>LOCAL_REPO_PATH</url>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/main</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="empty-list"/>
      <extensions/>
    </scm>
    <scriptPath>jenkins/Jenkinsfile</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
EOF

echo "Job configuration template created at jenkins/job_config.xml"
echo "--------------------------------------------------------"
echo "TO FINISH SETUP:"
echo "1. Replace 'LOCAL_REPO_PATH' in jenkins/job_config.xml with your Git URL."
echo "2. Run this command (requires your Jenkins admin password):"
echo "java -jar $CLI_JAR -s $JENKINS_URL -auth admin:YOUR_PASSWORD create-job Lineo-Master-Pipeline < jenkins/job_config.xml"
echo "--------------------------------------------------------"
