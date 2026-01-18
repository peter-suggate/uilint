import React from 'react';

interface MemberInfo {
  fullName: string;
  contactEmail: string;
  profileImage: string;
}

interface MemberCardProps {
  member: MemberInfo;
  onClick?: () => void;
}

export default function MemberCard({ member, onClick }: MemberCardProps) {
  return (
    <div
      className="member-card p-4 border-2 rounded-xl shadow-md hover:shadow-lg cursor-pointer"
      onClick={onClick}
    >
      <img
        src={member.profileImage}
        alt={`${member.fullName}'s profile`}
        className="w-20 h-20 rounded-full object-cover mx-auto"
      />
      <h4 className="text-md font-medium mt-2 text-center">{member.fullName}</h4>
      <p className="text-gray-500 text-sm text-center truncate">{member.contactEmail}</p>
    </div>
  );
}
