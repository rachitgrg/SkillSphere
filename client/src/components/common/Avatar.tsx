import { getInitials } from '../../utils/helpers';

interface AvatarProps {
  src?: string;
  firstName?: string;
  lastName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'busy';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

const statusSizes = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5',
  xl: 'w-4 h-4',
};

export function Avatar({ src, firstName = '', lastName = '', size = 'md', status, className = '' }: AvatarProps) {
  const initials = getInitials(firstName, lastName);

  return (
    <div className={`relative inline-flex ${className}`}>
      {src ? (
        <img
          src={src}
          alt={`${firstName} ${lastName}`}
          className={`${sizeClasses[size]} rounded-full object-cover ring-2 ring-dark-700`}
        />
      ) : (
        <div
          className={`
            ${sizeClasses[size]}
            rounded-full flex items-center justify-center font-semibold
            bg-gradient-to-br from-primary-500 to-accent-500
            ring-2 ring-dark-700
          `}
        >
          {initials}
        </div>
      )}
      {status && (
        <span
          className={`
            absolute bottom-0 right-0 ${statusSizes[size]} rounded-full border-2 border-dark-800
            ${status === 'online' ? 'bg-green-400' : status === 'busy' ? 'bg-yellow-400' : 'bg-dark-500'}
          `}
        />
      )}
    </div>
  );
}
