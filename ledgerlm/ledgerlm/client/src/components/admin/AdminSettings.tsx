import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useAuthUser } from '@/lib/auth';
import { 
  TrendingUp,
  Eye,
  CreditCard,
  Key,
  Upload,
  Trash2,
  Edit,
  Settings,
  ArrowRight,
  AlertTriangle,
  Database,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Shield,
  Lock
} from 'lucide-react';

// ── DB Connection Status Panel ────────────────────────────────────────────────

const MODE_LABELS: Record<string, { label: string; description: string; icon: React.ReactNode }> = {
  neon:           { label: 'Neon DB (Cloud)', description: 'Replit / NeonDB — NEON_DATABASE_URL', icon: <Database className="h-4 w-4" /> },
  '':             { label: 'Neon DB (Cloud)', description: 'Replit / NeonDB — NEON_DATABASE_URL', icon: <Database className="h-4 w-4" /> },
  'postgres-azure': { label: 'Azure PostgreSQL — Password', description: 'DB_HOST + DB_USER + DB_PASSWORD', icon: <Lock className="h-4 w-4" /> },
  entra:          { label: 'Azure PostgreSQL — Entra ID', description: 'Managed Identity token (auto-refreshed)', icon: <Shield className="h-4 w-4" /> },
  hybrid:         { label: 'Azure PostgreSQL — Entra + Password', description: 'Managed Identity token, password fallback', icon: <Shield className="h-4 w-4" /> },
};

interface DbStatus {
  mode: string;
  connected: boolean;
  host: string | null;
  database: string | null;
  tokenStatus: { cached: boolean; expiresInMin?: number } | null;
}

function DbConnectionPanel() {
  const [status, setStatus] = useState<DbStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/db-status');
      if (res.ok) setStatus(await res.json());
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { fetchStatus(); }, []);

  const modeInfo = status ? (MODE_LABELS[status.mode] ?? MODE_LABELS['neon']) : null;
  const isEntra = status?.mode === 'entra' || status?.mode === 'hybrid';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Database Connection</CardTitle>
              <CardDescription>
                Active connection mode and health status. Configure via environment variables before deployment.
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading} data-testid="button-refresh-db-status">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status row */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            {status?.connected
              ? <CheckCircle2 className="h-5 w-5 text-green-500" />
              : <XCircle className="h-5 w-5 text-destructive" />}
            <div>
              <p className="font-medium text-sm">
                {status?.connected ? 'Connected' : 'Connection Failed'}
              </p>
              {status?.host && (
                <p className="text-xs text-muted-foreground">{status.host} · {status.database}</p>
              )}
            </div>
          </div>
          {modeInfo && (
            <Badge variant="secondary" className="flex items-center gap-1">
              {modeInfo.icon}
              {modeInfo.label}
            </Badge>
          )}
        </div>

        {/* Entra token status */}
        {isEntra && status?.tokenStatus && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-2 rounded bg-blue-500/5 border border-blue-500/20">
            <Clock className="h-4 w-4 text-blue-500 shrink-0" />
            {status.tokenStatus.cached
              ? <>Entra token active · refreshes in <strong className="text-foreground ml-1">{status.tokenStatus.expiresInMin} min</strong></>
              : <>Entra token not yet cached — will fetch on next DB call</>}
          </div>
        )}

        <Separator />

        {/* How to configure guide */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            How to configure (set before app starts)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="font-semibold mb-1 flex items-center gap-1"><Database className="h-3.5 w-3.5" /> Replit / NeonDB</p>
              <p className="text-muted-foreground font-mono">NEON_DATABASE_URL = postgres://...neon.tech/...</p>
              <p className="text-muted-foreground mt-1">Set in Replit Secrets panel. No other vars needed.</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="font-semibold mb-1 flex items-center gap-1"><Database className="h-3.5 w-3.5" /> Local Dev</p>
              <p className="text-muted-foreground font-mono">DATABASE_URL = postgresql://user:pass@localhost:5432/db</p>
              <p className="text-muted-foreground mt-1">Set in .env file. SSL is disabled automatically.</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="font-semibold mb-1 flex items-center gap-1"><Lock className="h-3.5 w-3.5" /> Azure — Password</p>
              <p className="text-muted-foreground font-mono">DB_AUTH_MODE = postgres-azure</p>
              <p className="text-muted-foreground font-mono">DB_HOST · DB_NAME · DB_USER · DB_PASSWORD</p>
              <p className="text-muted-foreground mt-1">Set in App Service → Configuration.</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="font-semibold mb-1 flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Azure — Entra ID</p>
              <p className="text-muted-foreground font-mono">DB_AUTH_MODE = entra</p>
              <p className="text-muted-foreground font-mono">DB_HOST · DB_NAME · DB_USER</p>
              <p className="text-muted-foreground mt-1">No password. Token fetched from Azure IMDS automatically.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSettings() {
  const currentUser = useAuthUser();
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    fullName: currentUser?.displayName || 'John Smith',
    email: currentUser?.username || 'johnsmith@ledgerlm.ai',
    organization: 'LedgerLM',
    role: 'Admin',
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* DB Connection Status */}
      <DbConnectionPanel />

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-profile-views">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Profile Views</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">20</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-500">+12%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-subscription">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Subscription</span>
              <button className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="link-manage-plan">
                Manage Plan
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">Enterprise</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-licenses">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Active Licenses</span>
              <button className="text-xs text-primary hover:underline flex items-center gap-1" data-testid="link-manage-seats">
                Manage Seats
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-bold">12/50</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Manage your profile information and preferences</CardDescription>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setIsEditing(!isEditing)}
              data-testid="button-edit-profile"
            >
              <Edit className="h-4 w-4 mr-2" />
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            {/* Profile Picture */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-32 w-32">
                <AvatarImage src="" />
                <AvatarFallback className="text-2xl">{getInitials(profileData.fullName)}</AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" data-testid="button-upload-image">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                <Button variant="outline" size="sm" data-testid="button-delete-image">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                256x256 max 2MB
              </p>
            </div>

            {/* Profile Fields */}
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="fullName"
                    value={profileData.fullName}
                    onChange={(e) => setProfileData({ ...profileData, fullName: e.target.value })}
                    disabled={!isEditing}
                    data-testid="input-full-name"
                  />
                  {!isEditing && <Edit className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email Address</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    disabled={!isEditing}
                    data-testid="input-email"
                  />
                  {!isEditing && <Edit className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
              <div>
                <Label htmlFor="organization">Organization</Label>
                <Input
                  id="organization"
                  value={profileData.organization}
                  disabled
                  className="mt-1 bg-muted"
                  data-testid="input-organization"
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={profileData.role}
                  disabled
                  className="mt-1 bg-muted"
                  data-testid="input-role"
                />
              </div>
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end mt-6">
              <Button data-testid="button-save-profile">Save Changes</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account & Security */}
      <Card>
        <CardHeader>
          <CardTitle>Account & Security</CardTitle>
          <CardDescription>Manage access, API integrations, and ownership</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Manage API Settings */}
            <Card className="border-dashed" data-testid="card-api-settings">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Settings className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Manage API Settings</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Manage your API keys and integration settings
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4" data-testid="button-manage-api-keys">
                  Manage API Keys
                </Button>
              </CardContent>
            </Card>

            {/* Transfer Ownership */}
            <Card className="border-dashed" data-testid="card-transfer-ownership">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Transfer Admin Ownership</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Transfer admin ownership securely
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full mt-4" data-testid="button-transfer-ownership">
                  Transfer Ownership
                </Button>
              </CardContent>
            </Card>

            {/* Delete Account */}
            <Card className="border-dashed border-destructive/50" data-testid="card-delete-account">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-destructive/10 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">Remove your account</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Permanently delete admin account
                    </p>
                  </div>
                </div>
                <Button variant="destructive" className="w-full mt-4" data-testid="button-delete-account">
                  Delete Account
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
