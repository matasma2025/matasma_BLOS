import { useRef, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, apiRequestWithAdminStepUp, queryClient } from '@/lib/queryClient';
import { useAuthUser } from '@/lib/auth';
import { Trash2, UserPlus, Key, Edit, Globe, Shield, CheckCircle, Users, ShieldCheck, LockKeyhole } from 'lucide-react';
import SsoAuditDomainAdmin from '@/components/admin/SsoAuditDomainAdmin';

interface DomainInfo {
  isSuperAdmin: boolean;
  domain?: {
    id: string;
    name: string;
    adminEmail: string;
    defaultOtp: string | null;
    userCount: number;
    userQuota?: number | null;
  };
  domains?: Array<{
    id: string;
    name: string;
    adminEmail: string;
    defaultOtp: string | null;
    userQuota?: number | null;
  }>;
}

interface DomainUser {
  id: string;
  domainId: string;
  email: string;
  role: string;
  hardcodedOtp: string | null;
  createdAt: string;
}

export default function AdminUsers() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<DomainUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<DomainUser | null>(null);
  const [deleteDialogStage, setDeleteDialogStage] = useState<'confirm' | 'otp'>('confirm');
  const [deleteOtpCode, setDeleteOtpCode] = useState('');
  const pendingDeleteOtpResolver = useRef<((code: string | null) => void) | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string>('');
  const [newUser, setNewUser] = useState({ email: '', role: 'standard', hardcodedOtp: '' });
  const [editUser, setEditUser] = useState({ role: 'standard', hardcodedOtp: '' });
  const { toast } = useToast();
  const currentUser = useAuthUser();

  const isSuperAdmin = currentUser?.username?.toLowerCase() === 'customer@ledgerlm.ai';

  const collectDeleteAdminOtp = () =>
    new Promise<string | null>((resolve) => {
      pendingDeleteOtpResolver.current = resolve;
      setDeleteOtpCode('');
      setDeleteDialogStage('otp');
    });

  const resolveDeleteAdminOtp = (code: string | null) => {
    const resolve = pendingDeleteOtpResolver.current;
    if (!resolve) return;

    pendingDeleteOtpResolver.current = null;
    setDeleteOtpCode('');
    setDeleteDialogStage('confirm');
    resolve(code);
  };

  const { data: domainInfo, isLoading: domainLoading } = useQuery<DomainInfo>({
    queryKey: ['/api/domain-admin/my-domain'],
  });

  const currentDomainId = isSuperAdmin 
    ? selectedDomainId 
    : domainInfo?.domain?.id || '';

  const currentDomain = isSuperAdmin
    ? domainInfo?.domains?.find(d => d.id === selectedDomainId)
    : domainInfo?.domain;

  const { data: users = [], isLoading: usersLoading } = useQuery<DomainUser[]>({
    queryKey: ['/api/domain-admin/users', currentDomainId],
    queryFn: async () => {
      const url = isSuperAdmin 
        ? `/api/domain-admin/users?domainId=${currentDomainId}`
        : '/api/domain-admin/users';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: !!currentDomainId,
  });

  const addUserMutation = useMutation({
    mutationFn: async (data: typeof newUser) => {
      return apiRequestWithAdminStepUp(() => apiRequest('POST', '/api/domain-admin/users', {
        email: data.email,
        role: data.role,
        hardcodedOtp: data.hardcodedOtp || null,
        domainId: isSuperAdmin ? selectedDomainId : undefined,
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/my-domain'] });
      setIsAddDialogOpen(false);
      setNewUser({ email: '', role: 'standard', hardcodedOtp: '' });
      toast({ title: 'User added successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to add user',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editUser }) => {
      return apiRequestWithAdminStepUp(() => apiRequest('PUT', `/api/domain-admin/users/${id}`, {
        role: data.role,
        hardcodedOtp: data.hardcodedOtp || null,
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/users'] });
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      toast({ title: 'User updated successfully' });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to update user',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequestWithAdminStepUp(
        () => apiRequest('DELETE', `/api/domain-admin/users/${id}`),
        collectDeleteAdminOtp,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/domain-admin/my-domain'] });
      toast({ title: 'User removed successfully' });
    },
    onError: (error: any) => {
      setDeleteDialogStage('confirm');
      setDeleteOtpCode('');
      toast({
        title: 'Failed to remove user',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUser.email) {
      addUserMutation.mutate(newUser);
    }
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUser) {
      updateUserMutation.mutate({ id: selectedUser.id, data: editUser });
    }
  };

  const handleConfirmDeleteUser = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id, {
        onSuccess: () => {
          setUserToDelete(null);
          setDeleteDialogStage('confirm');
          setDeleteOtpCode('');
        },
      });
    }
  };

  const openEditDialog = (user: DomainUser) => {
    setSelectedUser(user);
    setEditUser({ role: user.role, hardcodedOtp: user.hardcodedOtp || '' });
    setIsEditDialogOpen(true);
  };

  if (domainLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-primary/10">
        <div className="rounded-xl border border-border/70 bg-white px-5 py-4 text-sm text-muted-foreground shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (!isSuperAdmin && !domainInfo?.domain) {
    return (
      <div className="flex h-full items-center justify-center bg-primary/10 p-4">
        <Card className="w-full max-w-md rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-base">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
                <Shield className="h-4 w-4 text-destructive" />
              </span>
              Access Denied
            </CardTitle>
            <CardDescription>
              You are not a domain administrator. Contact your administrator to get access.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-primary/10">
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="h-full min-h-full overflow-auto rounded-[18px] border border-border/60 bg-white flex flex-col shadow-sm">
          <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-primary/20 bg-primary/40 px-5 py-4 sm:px-6 lg:px-8">
            <div>
              <div className="mb-1 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <span>Administration</span>
                <span aria-hidden="true">/</span>
                <span>User access</span>
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground" data-testid="text-page-title">
                User Management
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm" data-testid="text-page-description">
                {isSuperAdmin 
                  ? 'Select a domain and manage its users' 
                  : `Manage users in ${domainInfo?.domain?.name}`}
              </p>
            </div>
            {currentDomainId && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="rounded-lg shadow-sm" data-testid="button-invite-user">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite New User</DialogTitle>
                    <DialogDescription>
                      Add a user to {currentDomain?.name}
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="user-email">Email Address</Label>
                      <Input
                        id="user-email"
                        type="email"
                        placeholder={`user@${currentDomain?.name || 'domain.com'}`}
                        value={newUser.email}
                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                        required
                        data-testid="input-invite-email"
                      />
                      <p className="text-xs text-muted-foreground">
                        Email must match the domain: @{currentDomain?.name}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-role">Role</Label>
                      <Select 
                        value={newUser.role} 
                        onValueChange={(value) => setNewUser({ ...newUser, role: value })}
                      >
                        <SelectTrigger data-testid="select-user-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="standard">Standard User</SelectItem>
                          <SelectItem value="admin">Domain Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="user-otp">Hardcoded OTP (optional)</Label>
                      <Input
                        id="user-otp"
                        placeholder="6-digit code"
                        value={newUser.hardcodedOtp}
                        onChange={(e) => setNewUser({ ...newUser, hardcodedOtp: e.target.value })}
                        maxLength={10}
                        data-testid="input-user-otp"
                      />
                      <p className="text-xs text-muted-foreground">
                        If set, this user will use this code instead of email OTP
                      </p>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={addUserMutation.isPending}
                      data-testid="button-send-invitation"
                    >
                      {addUserMutation.isPending ? 'Adding...' : 'Add User'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* ── Tabs: Users | SSO Audit ─────────────────────────────────── */}
          <Tabs defaultValue="users" className="flex-1 flex flex-col overflow-hidden min-h-0">
            <div className="flex h-12 flex-shrink-0 items-end border-b border-border/70 px-4 sm:px-6 lg:px-8">
              <TabsList className="mb-0 h-12 rounded-none bg-transparent p-0">
                <TabsTrigger
                  value="users"
                  className="h-9 gap-1.5 rounded-t-lg border-b-2 border-transparent px-3.5 text-xs font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  <Users className="h-3.5 w-3.5" /> Users
                </TabsTrigger>
                <TabsTrigger
                  value="sso-audit"
                  className="h-9 gap-1.5 rounded-t-lg border-b-2 border-transparent px-3.5 text-xs font-semibold text-muted-foreground data-[state=active]:border-primary data-[state=active]:bg-primary/5 data-[state=active]:text-primary data-[state=active]:shadow-none"
                >
                  <ShieldCheck className="h-3.5 w-3.5" /> SSO Audit
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ── Users tab ── */}
            <TabsContent value="users" className="m-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
              <div className="space-y-5">
                {isSuperAdmin && (
                  <Card className="rounded-xl border-border/70 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-3 text-base">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                          <Globe className="h-4 w-4 text-primary" />
                        </span>
                        Select Domain
                      </CardTitle>
                      <CardDescription className="text-xs">Choose a domain to manage its users</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
                        <SelectTrigger className="w-full" data-testid="select-domain">
                          <SelectValue placeholder="Select a domain to manage" />
                        </SelectTrigger>
                        <SelectContent>
                          {domainInfo?.domains?.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} - {d.adminEmail}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {domainInfo?.domains?.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          No domains created yet. Go to Domain Management to create one.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                {!isSuperAdmin && domainInfo?.domain && (
                  <Card className="rounded-xl border-border/70 shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Globe className="h-4 w-4" />
                        </span>
                        <div>
                          <CardTitle className="text-[13px] font-bold">Domain Information</CardTitle>
                          <CardDescription className="mt-0.5 text-[10px]">Identity settings and user capacity</CardDescription>
                        </div>
                        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          Active domain
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <div className="min-w-0 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                          <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Domain</span>
                          <span className="mt-1 block truncate text-xs font-semibold" data-testid="text-domain-name">{domainInfo.domain.name}</span>
                        </div>
                        <div className="min-w-0 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                          <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Admin</span>
                          <span className="mt-1 block truncate text-xs font-semibold">{domainInfo.domain.adminEmail}</span>
                        </div>
                        <div className="min-w-0 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                          <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Default OTP</span>
                          <span className="mt-1 block truncate text-xs font-semibold">
                            {domainInfo.domain.defaultOtp || 'Email OTP'}
                          </span>
                        </div>
                        <div className="min-w-0 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                          <span className="block text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Users</span>
                          <span className="mt-1 block text-xs font-semibold tabular-nums" data-testid="text-user-count">
                            {domainInfo.domain.userCount}
                            {domainInfo.domain.userQuota && (
                              <span className="text-muted-foreground"> / {domainInfo.domain.userQuota}</span>
                            )}
                          </span>
                        </div>
                        {domainInfo.domain.userQuota && (
                          <div className="rounded-lg border border-border/60 bg-muted/20 px-3.5 py-3 sm:col-span-2 xl:col-span-4">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <span className="text-[10px] font-semibold text-muted-foreground">Quota Usage</span>
                              <span className="text-[10px] font-bold tabular-nums text-primary">
                                {Math.round((domainInfo.domain.userCount / domainInfo.domain.userQuota) * 100)}% used
                                <span className="font-normal text-muted-foreground"> · {domainInfo.domain.userCount} of {domainInfo.domain.userQuota} seats</span>
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className={`h-full transition-all ${
                                  (domainInfo.domain.userCount / domainInfo.domain.userQuota) >= 0.9
                                    ? 'bg-destructive'
                                    : (domainInfo.domain.userCount / domainInfo.domain.userQuota) >= 0.7
                                      ? 'bg-yellow-500'
                                      : 'bg-primary'
                                }`}
                                style={{ width: `${Math.min(100, (domainInfo.domain.userCount / domainInfo.domain.userQuota) * 100)}%` }}
                              />
                            </div>
                            {(domainInfo.domain.userCount / domainInfo.domain.userQuota) >= 0.9 && (
                              <p className="mt-1 text-xs text-destructive">
                                Approaching user limit. Contact support to increase quota.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {currentDomainId && (
                  <Card className="rounded-xl border-border/70 shadow-sm">
                    <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-[13px] font-bold">
                          Domain Users
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">{users.length}</span>
                        </CardTitle>
                        <CardDescription className="mt-1 text-[10px]">Users registered in {currentDomain?.name || 'this domain'}</CardDescription>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <LockKeyhole className="h-3 w-3" />
                        Domain-scoped access
                      </span>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {usersLoading ? (
                        <div className="rounded-lg border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">Loading users...</div>
                      ) : users.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
                          No users in this domain yet. Click "Invite User" to add someone.
                        </div>
                      ) : (
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/40 hover:bg-muted/40">
                              <TableHead className="h-10 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Email</TableHead>
                              <TableHead className="h-10 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Role</TableHead>
                              <TableHead className="h-10 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">OTP</TableHead>
                              <TableHead className="h-10 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Added</TableHead>
                              <TableHead className="h-10 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {users.map((user) => (
                              <TableRow
                                key={user.id}
                                className="transition-colors hover:bg-muted/20"
                                data-testid={`row-user-${user.id}`}
                              >
                                <TableCell className="py-3.5 text-xs font-semibold">{user.email}</TableCell>
                                <TableCell>
                                  {user.role === 'admin' ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[9px] font-semibold text-primary">
                                      <CheckCircle className="h-3 w-3" />
                                      Admin
                                    </span>
                                  ) : (
                                    <span className="inline-flex rounded-full bg-muted px-2.5 py-1 text-[9px] font-medium text-muted-foreground">Standard</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {user.hardcodedOtp ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-[10px] font-mono">
                                      <Key className="h-3 w-3" />
                                      {user.hardcodedOtp}
                                    </span>
                                  ) : (
                                    <span className="inline-flex rounded-md bg-muted/60 px-2 py-1 text-[9px] text-muted-foreground">Email OTP</span>
                                  )}
                                </TableCell>
                                <TableCell className="py-3.5 text-[10px] tabular-nums text-muted-foreground">
                                  {new Date(user.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 gap-1 rounded-md border-border/70 px-2 py-0 text-[9px] font-semibold text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                                      onClick={() => openEditDialog(user)}
                                      data-testid={`button-edit-user-${user.id}`}
                                    >
                                      <Edit className="h-3 w-3" /> Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 gap-1 rounded-md border-destructive/20 px-2 py-0 text-[9px] font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive"
                                      onClick={() => setUserToDelete(user)}
                                      disabled={deleteUserMutation.isPending}
                                      data-testid={`button-delete-user-${user.id}`}
                                    >
                                      <Trash2 className="h-3 w-3" /> Delete
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </CardContent>
                  </Card>
                )}

                {!currentDomainId && isSuperAdmin && (
                  <Card className="rounded-xl border-border/70 shadow-sm">
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      Select a domain above to manage its users
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ── SSO Audit tab ── */}
            <TabsContent value="sso-audit" className="m-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
              {isSuperAdmin && !currentDomainId ? (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground text-sm">
                    Switch to the <strong>Users</strong> tab and select a domain first, then come back here to see its SSO audit log.
                  </CardContent>
                </Card>
              ) : (
                <SsoAuditDomainAdmin
                  domainId={currentDomainId}
                  domainName={currentDomain?.name}
                  isSuperAdmin={isSuperAdmin}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.email}</DialogTitle>
            <DialogDescription>Update user settings</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-role">Role</Label>
              <Select 
                value={editUser.role} 
                onValueChange={(value) => setEditUser({ ...editUser, role: value })}
              >
                <SelectTrigger data-testid="select-edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard User</SelectItem>
                  <SelectItem value="admin">Domain Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-otp">Hardcoded OTP (optional)</Label>
              <Input
                id="edit-otp"
                placeholder="6-digit code"
                value={editUser.hardcodedOtp}
                onChange={(e) => setEditUser({ ...editUser, hardcodedOtp: e.target.value })}
                maxLength={10}
                data-testid="input-edit-otp"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to use email-based OTP
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-submit-edit-user">
                {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!userToDelete}
        onOpenChange={(open) => {
          if (!open && !deleteUserMutation.isPending) {
            setUserToDelete(null);
            setDeleteDialogStage('confirm');
            setDeleteOtpCode('');
          }
        }}
      >
        <AlertDialogContent data-testid="dialog-delete-user">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteDialogStage === 'otp' ? 'Administrator verification' : 'Remove this user?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialogStage === 'otp' ? (
                <>
                  Enter the 6-digit administrator code sent to your email to continue removing{' '}
                  <span className="font-medium text-foreground">{userToDelete?.email}</span>.
                </>
              ) : (
                <>
                  Remove <span className="font-medium text-foreground">{userToDelete?.email}</span> from this domain and revoke their active sessions? This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteDialogStage === 'otp' ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                resolveDeleteAdminOtp(deleteOtpCode);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="delete-admin-otp">Verification code</Label>
                <Input
                  id="delete-admin-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Enter 6-digit code"
                  value={deleteOtpCode}
                  onChange={(event) => setDeleteOtpCode(event.target.value)}
                  disabled={!deleteUserMutation.isPending}
                  data-testid="input-delete-admin-otp"
                />
              </div>
              <AlertDialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => resolveDeleteAdminOtp(null)}
                  disabled={!deleteUserMutation.isPending}
                  data-testid="button-cancel-delete-admin-otp"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!deleteUserMutation.isPending}
                  data-testid="button-submit-delete-admin-otp"
                >
                  Verify &amp; Remove
                </Button>
              </AlertDialogFooter>
            </form>
          ) : (
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteUserMutation.isPending} data-testid="button-cancel-delete-user">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDeleteUser}
                disabled={deleteUserMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="button-confirm-delete-user"
              >
                {deleteUserMutation.isPending ? 'Removing...' : 'Remove User'}
              </AlertDialogAction>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
