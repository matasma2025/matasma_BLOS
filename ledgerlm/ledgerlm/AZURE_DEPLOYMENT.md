# LedgerLM — Azure Deployment Guide
### Azure App Service for Containers · PostgreSQL Flexible Server · Key Vault · Azure AD SSO

> **Who this is for:** Matasma IT / DevOps running commands from a **Windows or Mac laptop**.
> All Azure CLI commands run locally. Docker must be installed on the laptop.

---

## Prerequisites — Install on Your Laptop

| Tool | Install | Verify |
|---|---|---|
| Azure CLI | https://learn.microsoft.com/en-us/cli/azure/install-azure-cli | `az --version` |
| Docker Desktop | https://www.docker.com/products/docker-desktop | `docker --version` |
| Git | https://git-scm.com | `git --version` |

**Login to Azure:**
```bash
az login
# A browser window opens — sign in with your Bosch Azure account
# After login, confirm the correct subscription is selected:
az account show
# If wrong subscription:
az account set --subscription "YOUR_SUBSCRIPTION_NAME_OR_ID"
```

---

## PART 1 — Create Azure Resources

All resources go in the same Resource Group and Region. **Pick a region close to Bosch users** (e.g. `westeurope` for Germany).

### Step 1.1 — Set Variables (run once, reuse in all steps)

```bash
# ── Customize these values ──────────────────────────────────
REGION="westeurope"
RG="rg-ledgerlm-prod"
ACR_NAME="ledgerlmacr"                        # Must be globally unique, lowercase, no hyphens
PG_SERVER="ledgerlm-pg"                       # PostgreSQL server name
PG_DB="ledgerlm"                              # Database name
PG_ADMIN="ledgerlmadmin"                      # PostgreSQL admin username
PG_PASSWORD="CHANGE_THIS_Strong#Password1"    # Min 8 chars, upper+lower+number+symbol
APP_NAME="ledgerlm-bosch"                     # App Service name (becomes subdomain)
PLAN_NAME="asp-ledgerlm"
KV_NAME="kv-ledgerlm"                         # Key Vault name (globally unique)
# ────────────────────────────────────────────────────────────
```

> **Save these** — you will use them throughout this guide.

---

### Step 1.2 — Create Resource Group

```bash
az group create \
  --name $RG \
  --location $REGION
```

Expected output: `"provisioningState": "Succeeded"`

---

### Step 1.3 — Create Azure Container Registry (ACR)

```bash
az acr create \
  --name $ACR_NAME \
  --resource-group $RG \
  --location $REGION \
  --sku Basic \
  --admin-enabled true
```

Get the login server address (save this):
```bash
az acr show --name $ACR_NAME --query loginServer --output tsv
# Output example: ledgerlmacr.azurecr.io
ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer --output tsv)
```

---

### Step 1.4 — Create Azure PostgreSQL Flexible Server

```bash
az postgres flexible-server create \
  --name $PG_SERVER \
  --resource-group $RG \
  --location $REGION \
  --admin-user $PG_ADMIN \
  --admin-password "$PG_PASSWORD" \
  --sku-name Standard_B2ms \
  --tier Burstable \
  --storage-size 32 \
  --version 16 \
  --public-access 0.0.0.0
```

> This takes 3–5 minutes. `--public-access 0.0.0.0` allows Azure services to connect.
> For production with stricter networking, use VNet integration (ask Bosch networking team).

Create the database:
```bash
az postgres flexible-server db create \
  --server-name $PG_SERVER \
  --resource-group $RG \
  --database-name $PG_DB
```

Enable pgvector extension (required by LedgerLM for embeddings):
```bash
az postgres flexible-server parameter set \
  --server-name $PG_SERVER \
  --resource-group $RG \
  --name azure.extensions \
  --value VECTOR
```

Build the connection string (save this — you will put it in Key Vault):
```bash
PG_URL="postgresql://${PG_ADMIN}:${PG_PASSWORD}@${PG_SERVER}.postgres.database.azure.com/${PG_DB}?sslmode=require"
echo $PG_URL
```

---

### Step 1.5 — Create Azure Key Vault

```bash
az keyvault create \
  --name $KV_NAME \
  --resource-group $RG \
  --location $REGION \
  --enable-rbac-authorization false
```

Add secrets to Key Vault:
```bash
# PostgreSQL connection string
az keyvault secret set \
  --vault-name $KV_NAME \
  --name "NeonDatabaseUrl" \
  --value "$PG_URL"

# Session secret (generate a strong random string)
SESSION_SECRET=$(openssl rand -hex 32)
az keyvault secret set \
  --vault-name $KV_NAME \
  --name "SessionSecret" \
  --value "$SESSION_SECRET"

# OpenAI API Key (get from your OpenAI account)
az keyvault secret set \
  --vault-name $KV_NAME \
  --name "OpenaiApiKey" \
  --value "sk-REPLACE_WITH_YOUR_KEY"

# Encryption key for SSO secrets stored in DB (32 hex chars)
ENCRYPTION_KEY=$(openssl rand -hex 16)
az keyvault secret set \
  --vault-name $KV_NAME \
  --name "EncryptionKey" \
  --value "$ENCRYPTION_KEY"
```

> **Write down `SESSION_SECRET` and `ENCRYPTION_KEY`** — you cannot retrieve them later if Key Vault access is lost.

---

### Step 1.6 — Create App Service Plan

```bash
az appservice plan create \
  --name $PLAN_NAME \
  --resource-group $RG \
  --location $REGION \
  --is-linux \
  --sku P2v3
```

> **P2v3** = 2 vCPU, 8 GB RAM. Required — Node.js + Python + pgvector queries need headroom.
> Use `B2` only for staging/testing (~$75/month vs ~$180/month for P2v3).

---

### Step 1.7 — Create the Web App (App Service for Containers)

```bash
az webapp create \
  --name $APP_NAME \
  --resource-group $RG \
  --plan $PLAN_NAME \
  --deployment-container-image-name "${ACR_SERVER}/ledgerlm:latest"
```

Enable Managed Identity (required for Key Vault access):
```bash
az webapp identity assign \
  --name $APP_NAME \
  --resource-group $RG
```

Save the Principal ID:
```bash
PRINCIPAL_ID=$(az webapp identity show \
  --name $APP_NAME \
  --resource-group $RG \
  --query principalId --output tsv)
echo $PRINCIPAL_ID
```

Grant the App Service access to Key Vault:
```bash
az keyvault set-policy \
  --name $KV_NAME \
  --object-id $PRINCIPAL_ID \
  --secret-permissions get list
```

Grant the App Service permission to pull from ACR:
```bash
ACR_ID=$(az acr show --name $ACR_NAME --query id --output tsv)

az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role AcrPull \
  --scope $ACR_ID
```

---

## PART 2 — Configure App Service Settings

### Step 2.1 — Set Port

```bash
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RG \
  --settings WEBSITES_PORT=80
```

> The Dockerfile uses Nginx on port 80. `WEBSITES_PORT=80` tells Azure which port to route to.

---

### Step 2.2 — Set Environment Variables via Key Vault References

```bash
KV_URI="https://${KV_NAME}.vault.azure.net"

az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RG \
  --settings \
    NODE_ENV="production" \
    NEON_DATABASE_URL="@Microsoft.KeyVault(VaultName=${KV_NAME};SecretName=NeonDatabaseUrl)" \
    SESSION_SECRET="@Microsoft.KeyVault(VaultName=${KV_NAME};SecretName=SessionSecret)" \
    OPENAI_API_KEY="@Microsoft.KeyVault(VaultName=${KV_NAME};SecretName=OpenaiApiKey)" \
    ENCRYPTION_KEY="@Microsoft.KeyVault(VaultName=${KV_NAME};SecretName=EncryptionKey)" \
    PYTHON_BACKEND_URL="http://localhost:8000" \
    ALLOWED_ORIGINS="https://${APP_NAME}.azurewebsites.net"
```

> Key Vault references (`@Microsoft.KeyVault(...)`) mean the **secret value never appears** in the Azure Portal UI. Azure fetches it at runtime automatically.

---

### Step 2.3 — Critical Performance & Streaming Settings

```bash
# Disable ARR Affinity — REQUIRED for SSE chat streaming
az webapp update \
  --name $APP_NAME \
  --resource-group $RG \
  --client-affinity-enabled false

# Always On — prevents cold starts (requires P-series plan)
az webapp config set \
  --name $APP_NAME \
  --resource-group $RG \
  --always-on true

# Increase startup timeout for Python backend warm-up
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RG \
  --settings WEBSITES_CONTAINER_START_TIME_LIMIT=300
```

---

### Step 2.4 — Configure ACR Pull (connect App Service → ACR)

```bash
az webapp config container set \
  --name $APP_NAME \
  --resource-group $RG \
  --docker-custom-image-name "${ACR_SERVER}/ledgerlm:latest" \
  --docker-registry-server-url "https://${ACR_SERVER}"
```

---

## PART 3 — Build & Push Docker Image from Laptop

### Step 3.1 — Login to ACR from Laptop

```bash
az acr login --name $ACR_NAME
```

### Step 3.2 — Clone / Pull Latest Code

```bash
# If first time:
git clone https://github.com/YOUR_ORG/ledgerlm.git
cd ledgerlm/ledgerlm    # The app root is inside ledgerlm/ledgerlm/

# If updating:
git pull origin main
cd ledgerlm
```

### Step 3.3 — Build the Docker Image

```bash
# Run from the ledgerlm/ app folder (where Dockerfile lives)
docker build -t ${ACR_SERVER}/ledgerlm:latest -t ${ACR_SERVER}/ledgerlm:v1.0.0 .
```

> This takes **5–15 minutes** on first build (installs Node deps + Python deps).
> Subsequent builds are faster due to Docker layer caching.

### Step 3.4 — Push to ACR

```bash
docker push ${ACR_SERVER}/ledgerlm:latest
docker push ${ACR_SERVER}/ledgerlm:v1.0.0
```

Verify the image is in ACR:
```bash
az acr repository list --name $ACR_NAME --output table
az acr repository show-tags --name $ACR_NAME --repository ledgerlm --output table
```

---

## PART 4 — Deploy & Verify

### Step 4.1 — Trigger Deployment

```bash
az webapp restart \
  --name $APP_NAME \
  --resource-group $RG
```

### Step 4.2 — Watch Deployment Logs (Live)

```bash
az webapp log tail \
  --name $APP_NAME \
  --resource-group $RG
```

Wait until you see:
```
[express] serving on port 5000
Python backend started successfully
Found 690,565 rows of fact data
```

Press `Ctrl+C` to stop tailing.

### Step 4.3 — Verify the App is Running

```bash
APP_URL="https://${APP_NAME}.azurewebsites.net"
curl -I $APP_URL
# Expected: HTTP/2 200
```

Open in browser: `https://ledgerlm-bosch.azurewebsites.net`

---

## PART 5 — Azure AD / IDM SSO Integration

SSO credentials are configured **per tenant in the LedgerLM admin UI**, not as global env vars.
Each Bosch sub-company (tenant) gets its own Azure AD App Registration.

### Step 5.1 — Register LedgerLM in Azure AD (Bosch IT does this)

In the **Azure Portal → Azure Active Directory → App registrations → New registration:**

| Field | Value |
|---|---|
| Name | `LedgerLM` |
| Supported account types | `Accounts in this organizational directory only` |
| Redirect URI | `https://ledgerlm-bosch.azurewebsites.net/api/auth/sso/microsoft/callback` |

After registration, note down:
- **Application (client) ID** → `ssoClientId`
- **Directory (tenant) ID** → `ssoTenantId`

**Create a client secret:**
`Azure AD → App registrations → LedgerLM → Certificates & secrets → New client secret`

| Field | Value |
|---|---|
| Description | `LedgerLM Production` |
| Expires | `24 months` |

Copy the secret **value** immediately — it only shows once.

**Set API permissions:**
`API permissions → Add permission → Microsoft Graph → Delegated`
- `openid`
- `profile`
- `email`
- `User.Read`

Click **Grant admin consent for Bosch**.

---

### Step 5.2 — Configure SSO in LedgerLM Admin UI

1. Log in as Super Admin: `customer@ledgerlm.ai`
2. Navigate to **Admin → Domains → in.bosch.com → SSO Settings**
3. Enter:
   - **Tenant ID**: from Step 5.1
   - **Client ID**: from Step 5.1
   - **Client Secret**: from Step 5.1 (stored encrypted in DB)
4. Enable SSO toggle
5. Test with a Bosch user account

> The client secret is AES-256 encrypted before being stored in PostgreSQL using the `ENCRYPTION_KEY` set in Key Vault.

---

## PART 6 — Custom Domain (Optional but Recommended)

### Do you need a public IP or custom domain?

| Scenario | Answer |
|---|---|
| Internal Bosch users only (VPN) | Custom domain **recommended** — cleaner URL. Public IP not needed — App Service provides HTTPS by default. |
| Public-facing | Custom domain **required** for branded URL. Azure provides the SSL cert for free. |
| Just testing | Use `https://ledgerlm-bosch.azurewebsites.net` — works immediately, no setup needed. |

> **You do NOT need a dedicated public IP address.** Azure App Service gives you a shared public IP automatically, with HTTPS via `azurewebsites.net`. A custom domain is just a nicer URL on top.

### Step 6.1 — Add Custom Domain

In **Bosch DNS**, create a CNAME record:
```
ledgerlm.bosch.com  →  CNAME  →  ledgerlm-bosch.azurewebsites.net
```

Then in Azure:
```bash
az webapp config hostname add \
  --webapp-name $APP_NAME \
  --resource-group $RG \
  --hostname "ledgerlm.bosch.com"
```

### Step 6.2 — Add Free Managed SSL Certificate

```bash
az webapp config ssl create \
  --resource-group $RG \
  --name $APP_NAME \
  --hostname "ledgerlm.bosch.com"
```

Update ALLOWED_ORIGINS to include the custom domain:
```bash
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RG \
  --settings ALLOWED_ORIGINS="https://ledgerlm-bosch.azurewebsites.net,https://ledgerlm.bosch.com"
```

Update the Azure AD redirect URI:
`Azure AD → App registrations → LedgerLM → Authentication`
Add: `https://ledgerlm.bosch.com/api/auth/sso/microsoft/callback`

---

## PART 7 — Set Up Health Check & Alerting

### Step 7.1 — Enable Health Check

```bash
az webapp config set \
  --name $APP_NAME \
  --resource-group $RG \
  --generic-configurations '{"healthCheckPath": "/api/health"}'
```

Azure will auto-restart the container if `/api/health` returns non-200.

### Step 7.2 — Enable Application Logs

```bash
az webapp log config \
  --name $APP_NAME \
  --resource-group $RG \
  --application-logging filesystem \
  --level information \
  --retention-in-days 7
```

---

## PART 8 — Updating the App (Future Deployments)

Every time you push new code, run this sequence from your laptop:

```bash
cd ledgerlm   # app root folder

# Pull latest code
git pull origin main

# Build new image with a version tag
VERSION=$(date +%Y%m%d-%H%M)
docker build -t ${ACR_SERVER}/ledgerlm:latest \
             -t ${ACR_SERVER}/ledgerlm:$VERSION .

# Push to ACR
docker push ${ACR_SERVER}/ledgerlm:latest
docker push ${ACR_SERVER}/ledgerlm:$VERSION

# Restart App Service to pull new image
az webapp restart --name $APP_NAME --resource-group $RG

# Watch logs
az webapp log tail --name $APP_NAME --resource-group $RG
```

---

## Summary — Full Resource Checklist

| Resource | Name | Status |
|---|---|---|
| Resource Group | `rg-ledgerlm-prod` | ☐ |
| Container Registry | `ledgerlmacr` | ☐ |
| PostgreSQL Flexible Server | `ledgerlm-pg` | ☐ |
| PostgreSQL Database | `ledgerlm` | ☐ |
| Key Vault | `kv-ledgerlm` | ☐ |
| App Service Plan | `asp-ledgerlm` (P2v3, Linux) | ☐ |
| Web App | `ledgerlm-bosch` | ☐ |
| Managed Identity assigned | App Service → Key Vault | ☐ |
| AcrPull role assigned | App Service → ACR | ☐ |
| Docker image built & pushed | `ledgerlmacr.azurecr.io/ledgerlm:latest` | ☐ |
| App running on `.azurewebsites.net` | HTTPS 200 | ☐ |
| Azure AD App Registration | SSO callback URL set | ☐ |
| SSO configured in Admin UI | Bosch tenant | ☐ |
| Custom domain + SSL | `ledgerlm.bosch.com` (optional) | ☐ |

---

## Estimated Costs (West Europe)

| Resource | Tier | Monthly Cost |
|---|---|---|
| App Service | P2v3 Linux | ~€165 |
| PostgreSQL Flexible Server | Standard_B2ms | ~€55 |
| Container Registry | Basic | ~€5 |
| Key Vault | Standard | ~€0.05/10k ops |
| Bandwidth | First 5GB free | ~€0–10 |
| **Total** | | **~€230/month** |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| App shows "Application Error" | Container failed to start | `az webapp log tail` — look for Python or Node error |
| Key Vault reference shows `Invalid` | Managed Identity not granted | Re-run `az keyvault set-policy` |
| SSE chat cuts off after 3 min | ARR Affinity on | Set `--client-affinity-enabled false` |
| Login redirects to wrong URL | Wrong redirect URI in Azure AD | Add exact URL in App Registration → Authentication |
| DB connection timeout on start | PostgreSQL firewall | Add App Service outbound IPs to PG firewall rules |
| `pgvector` extension error | Extension not enabled | Re-run the `azure.extensions` parameter set command |
