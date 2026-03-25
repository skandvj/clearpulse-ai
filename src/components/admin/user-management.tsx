"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { useUsers, useUpdateUser, type AdminUser, type UserRole } from "@/lib/hooks/use-users";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLE_OPTIONS: UserRole[] = ["ADMIN", "LEADERSHIP", "CSM", "VIEWER"];

function formatDateTime(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
      Active
    </Badge>
  ) : (
    <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">
      Inactive
    </Badge>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge variant="outline" className="text-xs">
      {role.replace(/_/g, " ")}
    </Badge>
  );
}

interface UserManagementProps {
  currentUserId: string;
}

export function UserManagement({ currentUserId }: UserManagementProps) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const deferredSearch = useDeferredValue(search);
  const usersQuery = useUsers(deferredSearch.trim() || undefined);
  const updateUser = useUpdateUser();

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);

  const handleRoleChange = async (user: AdminUser, role: UserRole) => {
    if (role === user.role) return;

    try {
      await updateUser.mutateAsync({ id: user.id, role });
      toast.success(`Updated ${user.email} to ${role}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    }
  };

  const toggleUserStatus = async (user: AdminUser) => {
    try {
      await updateUser.mutateAsync({ id: user.id, isActive: !user.isActive });
      toast.success(
        `${user.isActive ? "Deactivated" : "Reactivated"} ${user.email}`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update user status"
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              className="pl-9"
            />
          </div>
        </div>
        <Button className="gap-2" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      <Card className="rounded-2xl border-gray-100 shadow-sm">
        <CardContent className="p-0">
          {usersQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              Loading users…
            </div>
          ) : users.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-slate-500">
              No users match this search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const isCurrentUser = user.id === currentUserId;

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">
                              {user.name || "Unnamed User"}
                            </span>
                            {isCurrentUser ? (
                              <Badge variant="secondary" className="text-[10px]">
                                You
                              </Badge>
                            ) : null}
                          </div>
                          <span className="text-sm text-slate-500">
                            {user.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isCurrentUser ? (
                          <RoleBadge role={user.role} />
                        ) : (
                          <Select
                            value={user.role}
                            onValueChange={(value) =>
                              handleRoleChange(user, value as UserRole)
                            }
                          >
                            <SelectTrigger className="w-[170px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((role) => (
                                <SelectItem key={role} value={role}>
                                  {role.replace(/_/g, " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge isActive={user.isActive} />
                      </TableCell>
                      <TableCell>{user._count.accounts}</TableCell>
                      <TableCell>{formatDateTime(user.lastLogin)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isCurrentUser || updateUser.isPending}
                          onClick={() => toggleUserStatus(user)}
                        >
                          {user.isActive ? "Deactivate" : "Reactivate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateUserDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
