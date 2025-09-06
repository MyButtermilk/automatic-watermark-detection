"use client";

import { useTransition } from "react";
import type { User } from "@prisma/client";
import { changeUserRole, toggleUserActive } from "@/lib/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MemberListProps {
  users: User[];
  currentAdminId: string;
}

export function MemberList({ users, currentAdminId }: MemberListProps) {
  const [isPending, startTransition] = useTransition();

  const handleRoleChange = (userId: string, role: string) => {
    startTransition(async () => {
      const result = await changeUserRole(userId, role);
      if (result?.error) {
        alert(`Fehler: ${result.error}`);
      }
    });
  };

  const handleActiveToggle = (userId: string, active: boolean) => {
    startTransition(() => {
      toggleUserActive(userId, active);
    });
  };

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Rolle</TableHead>
            <TableHead>Aktiv</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.name}</TableCell>
              <TableCell className="text-muted-foreground">{user.email}</TableCell>
              <TableCell>
                <Select
                  defaultValue={user.role}
                  onValueChange={(value) => handleRoleChange(user.id, value)}
                  disabled={isPending || user.id === currentAdminId}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Switch
                  checked={user.active}
                  onCheckedChange={(checked) => handleActiveToggle(user.id, checked)}
                  disabled={isPending || user.id === currentAdminId}
                  aria-label="Benutzerstatus"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
