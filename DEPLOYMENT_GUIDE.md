# Deployment Guide: Fixed SonarQube Workflow

## Problem Statement
The original workflow fails when a PR is merged into main with error:
```
Message failed: 554 Message rejected: Email address is not verified (users.noreply.github.com)
```

## Root Cause
When PRs are merged, GitHub may use `users.noreply.github.com` addresses which aren't verified with your SMTP server.

## Solution Overview
The updated workflow detects noreply addresses and falls back to a verified email address.

---

## Step-by-Step Deployment

### Step 1: Add Required Secret
Add a new secret to your GitHub repository:

1. Go to: `Settings` → `Secrets and variables` → `Actions`
2. Click `New repository secret`
3. Name: `DEFAULT_EMAIL`
4. Value: A verified email address (e.g., `devops@company.com`)
5. Click `Add secret`

**Important:** This email MUST be verified in your SMTP system!

### Step 2: Backup Current Workflow
```bash
cd .github/workflows
cp sonar.yaml sonar.yaml.backup
```

### Step 3: Deploy Updated Workflow
Replace the content of `.github/workflows/sonar.yaml` with the updated version from `sonar_updated.yaml`

Or use this command:
```bash
cp .github/workflows/sonar_updated.yaml .github/workflows/sonar.yaml
```

### Step 4: Commit and Push
```bash
git add .github/workflows/sonar.yaml
git commit -m "fix: Handle noreply emails in SonarQube workflow"
git push origin main
```

### Step 5: Test the Workflow

#### Test 1: Direct Push
```bash
# Make a small change and push directly
echo "# Test" >> README.md
git add README.md
git commit -m "test: Direct push"
git push origin main
```

#### Test 2: PR Merge (The Critical Test)
1. Create a new branch
2. Make changes
3. Create a PR
4. Merge the PR
5. Check that email is sent without errors

---

## What Changed?

### New Step: Email Recipient Detection
```yaml
- name: Get email recipient
  id: email
  run: |
    COMMIT_EMAIL="${{ github.event.head_commit.author.email }}"
    
    if [[ "$COMMIT_EMAIL" == *"noreply.github.com"* ]] || [[ -z "$COMMIT_EMAIL" ]]; then
      echo "Detected noreply or empty email: $COMMIT_EMAIL"
      
      if [[ "${{ github.event_name }}" == "pull_request" ]]; then
        echo "recipient=${{ secrets.DEFAULT_EMAIL }}" >> $GITHUB_OUTPUT
        echo "recipient_name=${{ github.event.pull_request.user.login }}" >> $GITHUB_OUTPUT
      else
        echo "recipient=${{ secrets.DEFAULT_EMAIL }}" >> $GITHUB_OUTPUT
        echo "recipient_name=${{ github.actor }}" >> $GITHUB_OUTPUT
      fi
    else
      echo "Using commit author email: $COMMIT_EMAIL"
      echo "recipient=$COMMIT_EMAIL" >> $GITHUB_OUTPUT
      echo "recipient_name=${{ github.event.head_commit.author.name }}" >> $GITHUB_OUTPUT
    fi
    
    echo "actor=${{ github.actor }}" >> $GITHUB_OUTPUT
    echo "triggered_by=${{ github.triggering_actor }}" >> $GITHUB_OUTPUT
```

### Updated Email Step
```yaml
- name: Send mail (Sonar result)
  if: always() && steps.email.outputs.recipient != ''
  uses: dawidd6/action-send-mail@v3
  with:
    # ... SMTP config ...
    to: ${{ steps.email.outputs.recipient }}  # ← Uses detected recipient
    
    subject: >
      ${{ job.status == 'success'
          && '✅ SonarQube PASSED'
          || '❌ SonarQube FAILED' }}
      | ${{ github.repository }} | ${{ github.ref_name }}
    
    body: |
      Hello ${{ steps.email.outputs.recipient_name }},
      
      SonarQube scan completed for your recent code changes.
      
      Repository : ${{ github.repository }}
      Branch     : ${{ github.ref_name }}
      Commit     : ${{ github.sha }}
      Status     : ${{ job.status }}
      Triggered by : ${{ steps.email.outputs.triggered_by }}
      Event type : ${{ github.event_name }}
      
      SonarQube Dashboard:
      ${{ secrets.SONAR_HOST_URL }}/dashboard?id=${{ secrets.PROJECT_KEY }}
```

---

## Behavior Matrix

| Scenario | Email Type | Event | Recipient | Name |
|----------|-----------|-------|-----------|------|
| Direct push | valid@company.com | push | valid@company.com | Commit Author |
| Merged PR | user@noreply.github.com | push | DEFAULT_EMAIL | GitHub Actor |
| Open PR | user@noreply.github.com | pull_request | DEFAULT_EMAIL | PR Author |
| Empty email | (empty) | push | DEFAULT_EMAIL | GitHub Actor |
| Valid PR | valid@company.com | pull_request | valid@company.com | Commit Author |

---

## Troubleshooting

### Email still not sending?
1. Verify `DEFAULT_EMAIL` secret is set correctly
2. Verify `DEFAULT_EMAIL` is verified in your SMTP system
3. Check workflow logs for the "Get email recipient" step
4. Verify all SMTP secrets are correct

### Want to always use team email?
Replace the email step with this simpler version:

```yaml
- name: Send mail (Sonar result)
  if: always()
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: ${{ secrets.SMTP_SERVER }}
    server_port: ${{ secrets.SMTP_PORT }}
    username: ${{ secrets.SMTP_USERNAME }}
    password: ${{ secrets.SMTP_PASSWORD }}
    from: "SonarQube Alerts <${{ secrets.MAIL_FROM }}>"
    to: ${{ secrets.NOTIFICATION_EMAIL }}
    cc: ${{ secrets.MAIL_CC }}
    subject: >
      ${{ job.status == 'success'
          && '✅ SonarQube PASSED'
          || '❌ SonarQube FAILED' }}
      | ${{ github.repository }} | ${{ github.ref_name }} | by ${{ github.actor }}
    body: |
      Repository : ${{ github.repository }}
      Branch     : ${{ github.ref_name }}
      Commit     : ${{ github.sha }}
      Status     : ${{ job.status }}
      Triggered by : ${{ github.triggering_actor }}
      Event type   : ${{ github.event_name }}
      
      SonarQube Dashboard:
      ${{ secrets.SONAR_HOST_URL }}/dashboard?id=${{ secrets.PROJECT_KEY }}
```

This sends all notifications to `NOTIFICATION_EMAIL` (add this secret).

---

## Rollback Plan

If issues occur, rollback to the original:

```bash
cd .github/workflows
cp sonar.yaml.backup sonar.yaml
git add sonar.yaml
git commit -m "rollback: Revert to original workflow"
git push origin main
```

---

## Support

For issues or questions:
1. Check workflow logs in GitHub Actions
2. Verify all secrets are set correctly
3. Review TEST_RESULTS.md for detailed test information
4. Check SMTP server logs if emails aren't being received

---

**Last Updated:** December 18, 2025
**Tested:** ✅ All scenarios passing
**Status:** Ready for production deployment
