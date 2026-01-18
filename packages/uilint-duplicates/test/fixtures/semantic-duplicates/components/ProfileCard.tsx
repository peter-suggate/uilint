import React from 'react';

type ProfileDisplayProps = {
  profile: {
    displayName: string;
    emailAddress: string;
    avatarUrl: string;
  };
};

export const ProfileCard: React.FC<ProfileDisplayProps> = ({ profile }) => {
  return (
    <article className="card p-3 border rounded shadow bg-surface">
      <img
        src={profile.avatarUrl}
        alt="Profile avatar"
        className="avatar w-14 h-14 rounded-full block mx-auto"
      />
      <h2 className="title font-bold mt-3 text-center">{profile.displayName}</h2>
      <span className="email text-muted text-xs text-center block">{profile.emailAddress}</span>
    </article>
  );
};
