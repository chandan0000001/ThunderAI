import React, { useState } from 'react';

interface UserAvatarProps {
  avatar?: string;
  name?: string;
  className?: string;
  textClassName?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = React.memo(({
  avatar,
  name = 'User',
  className = 'w-full h-full object-cover',
  textClassName = 'font-bold text-xs text-white',
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const initial = (name || 'U').charAt(0).toUpperCase();

  if (avatar && !imageFailed) {
    return (
      <img
        src={avatar}
        alt={`${name} avatar`}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setImageFailed(true)}
        className={className}
      />
    );
  }

  return (
    <span className={`w-full h-full flex items-center justify-center ${textClassName}`}>
      {initial}
    </span>
  );
});

export default UserAvatar;
