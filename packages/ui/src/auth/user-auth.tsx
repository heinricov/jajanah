import { LogOut, Settings, User } from 'lucide-react';
import { cn } from '@packages/ui/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/dropdown-menu';

export type UserAuthUser = {
  name?: string;
  image?: string;
};

export type UserAuthProps = {
  user?: UserAuthUser;
  onProfile?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
  triggerClassName?: string;
  menuLabel?: React.ReactNode;
};

export function UserAuth({
  user,
  onProfile,
  onSettings,
  onLogout,
  triggerClassName,
  menuLabel,
}: UserAuthProps) {
  const hasItems = Boolean(onProfile || onSettings || onLogout);
  const initials =
    user?.name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0))
      .join('')
      .toUpperCase() || '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'rounded-full focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2',
          triggerClassName,
        )}
      >
        <Avatar>
          {user?.image ? <AvatarImage src={user.image} alt={user.name ?? ''} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{menuLabel ?? user?.name ?? 'My Account'}</DropdownMenuLabel>
        {hasItems ? (
          <>
            <DropdownMenuSeparator />
            {onProfile ? (
              <DropdownMenuItem onSelect={onProfile}>
                <User className="h-4 w-4" /> Profile
              </DropdownMenuItem>
            ) : null}
            {onSettings ? (
              <DropdownMenuItem onSelect={onSettings}>
                <Settings className="h-4 w-4" /> Settings
              </DropdownMenuItem>
            ) : null}
            {onLogout ? (
              <DropdownMenuItem variant="destructive" onSelect={onLogout}>
                <LogOut className="h-4 w-4" /> Logout
              </DropdownMenuItem>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
