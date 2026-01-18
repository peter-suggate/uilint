import React, { useState, FormEvent } from 'react';

type SignInFormProps = {
  handleSignIn: (credentials: { email: string; pass: string }) => Promise<void>;
  showResetLink?: boolean;
  onResetClick?: () => void;
};

export const SignInForm: React.FC<SignInFormProps> = ({
  handleSignIn,
  showResetLink = true,
  onResetClick
}) => {
  const [formData, setFormData] = useState({ email: '', pass: '' });
  const [validation, setValidation] = useState({ email: '', pass: '' });

  const validateForm = (): boolean => {
    const issues = { email: '', pass: '' };

    if (!formData.email.trim()) {
      issues.email = 'Please enter your email';
    }
    if (!formData.pass) {
      issues.pass = 'Please enter your password';
    }

    setValidation(issues);
    return !issues.email && !issues.pass;
  };

  const onFormSubmit = async (evt: FormEvent) => {
    evt.preventDefault();
    if (validateForm()) {
      await handleSignIn(formData);
    }
  };

  return (
    <form onSubmit={onFormSubmit} className="flex flex-col gap-4">
      <div className="form-group">
        <label className="text-sm font-semibold mb-1 block">Email Address</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          className="w-full border rounded px-3 py-2"
          placeholder="you@example.com"
        />
        {validation.email && <p className="text-red-600 text-xs mt-1">{validation.email}</p>}
      </div>
      <div className="form-group">
        <label className="text-sm font-semibold mb-1 block">Password</label>
        <input
          type="password"
          value={formData.pass}
          onChange={(e) => setFormData(prev => ({ ...prev, pass: e.target.value }))}
          className="w-full border rounded px-3 py-2"
          placeholder="Enter your password"
        />
        {validation.pass && <p className="text-red-600 text-xs mt-1">{validation.pass}</p>}
      </div>
      <button
        type="submit"
        className="bg-primary text-white py-2 px-4 rounded font-medium"
      >
        Sign In
      </button>
      {showResetLink && onResetClick && (
        <button
          type="button"
          onClick={onResetClick}
          className="text-primary text-sm underline"
        >
          Reset password
        </button>
      )}
    </form>
  );
};
