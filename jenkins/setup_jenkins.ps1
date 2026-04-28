# Lineo Jenkins Setup Script (Windows PowerShell)
# Run this to create your job automatically!

$JENKINS_URL = "http://localhost:9090"
$CLI_PATH = "jenkins/jenkins-cli.jar"
$ADMIN_USER = "ritesh"
$ADMIN_PASS = "Ritesh@2004" # Your password from earlier

Write-Host "Starting Lineo Jenkins Automation..." -ForegroundColor Cyan

# 1. Download CLI if missing
if (-not (Test-Path $CLI_PATH)) {
    Write-Host "Downloading Jenkins CLI tool..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri "$JENKINS_URL/jnlpJars/jenkins-cli.jar" -OutFile $CLI_PATH
}

# 2. Create Job XML (Pointing to jenkins/Jenkinsfile)
$xmlConfig = @"
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>Lineo Master CI/CD Pipeline - Automated Setup</description>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-scm">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>/src/lineo</url> 
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/main</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
    </scm>
    <scriptPath>jenkins/Jenkinsfile</scriptPath>
    <lightweight>true</lightweight>
  </definition>
</flow-definition>
"@

$xmlConfig | Out-File -FilePath "jenkins/job_config.xml" -Encoding utf8

# 3. Push to Jenkins
Write-Host "Syncing job 'Lineo-Master' with Jenkins..." -ForegroundColor Yellow

# Try updating first, if fails, create it
$updateResult = Get-Content jenkins/job_config.xml | java -jar $CLI_PATH -s $JENKINS_URL -auth "$($ADMIN_USER):$($ADMIN_PASS)" update-job Lineo-Master 2>$null
if (!$?) {
    Get-Content jenkins/job_config.xml | java -jar $CLI_PATH -s $JENKINS_URL -auth "$($ADMIN_USER):$($ADMIN_PASS)" create-job Lineo-Master
}

Write-Host "DONE! Your job 'Lineo-Master' is now ready in Jenkins." -ForegroundColor Green
Write-Host "Go to: $JENKINS_URL/job/Lineo-Master/" -ForegroundColor Cyan
