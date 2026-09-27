import { cn } from '@packages/ui/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@packages/ui/components/card';

export type AuthCardProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  logo?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  cardClassName?: string;
};

export function AuthCard({
  title,
  description,
  logo,
  footer,
  children,
  className,
  cardClassName,
}: AuthCardProps) {
  return (
    <section
      className={cn(
        'flex w-full items-center justify-center bg-background px-6 py-12 text-foreground',
        className,
      )}
    >
      <Card className={cn('w-full max-w-sm', cardClassName)}>
        <CardHeader className={cn('text-center', logo && 'items-center')}>
          {logo}
          <CardTitle className={cn('text-xl font-bold tracking-tight', logo && 'mt-4')}>
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="text-sm">{description}</CardDescription>
          ) : null}
        </CardHeader>

        <CardContent className="flex flex-col gap-6">{children}</CardContent>

        {footer ? (
          <CardFooter className="justify-center text-sm text-muted-foreground">{footer}</CardFooter>
        ) : null}
      </Card>
    </section>
  );
}
