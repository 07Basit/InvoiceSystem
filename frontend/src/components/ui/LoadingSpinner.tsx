import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  fullScreen?: boolean;
  className?: string;
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ fullScreen, className, message }) => {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-background gap-3">
        <div className="h-12 w-12 rounded-2xl bg-[hsl(var(--primary))]/10 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary))]" />
        </div>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>
    );
  }
  return <Loader2 className={cn('h-5 w-5 animate-spin text-[hsl(var(--primary))]', className)} />;
};

export default LoadingSpinner;
