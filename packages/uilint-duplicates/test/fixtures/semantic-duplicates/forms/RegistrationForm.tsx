import React, { useState } from 'react';

interface RegistrationData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

interface RegistrationFormProps {
  onRegister: (data: RegistrationData) => Promise<void>;
}

export function RegistrationForm({ onRegister }: RegistrationFormProps) {
  const [formData, setFormData] = useState<RegistrationData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegistrationData, string>>>({});

  const validate = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!formData.acceptTerms) newErrors.acceptTerms = 'You must accept the terms';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      await onRegister(formData);
    }
  };

  const updateField = (field: keyof RegistrationData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">First Name</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => updateField('firstName', e.target.value)}
            className="mt-1 block w-full rounded-md border p-2"
          />
          {errors.firstName && <span className="text-red-500 text-sm">{errors.firstName}</span>}
        </div>
        <div>
          <label className="block text-sm font-medium">Last Name</label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => updateField('lastName', e.target.value)}
            className="mt-1 block w-full rounded-md border p-2"
          />
          {errors.lastName && <span className="text-red-500 text-sm">{errors.lastName}</span>}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium">Email</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => updateField('email', e.target.value)}
          className="mt-1 block w-full rounded-md border p-2"
        />
        {errors.email && <span className="text-red-500 text-sm">{errors.email}</span>}
      </div>
      <div>
        <label className="block text-sm font-medium">Password</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => updateField('password', e.target.value)}
          className="mt-1 block w-full rounded-md border p-2"
        />
        {errors.password && <span className="text-red-500 text-sm">{errors.password}</span>}
      </div>
      <div>
        <label className="block text-sm font-medium">Confirm Password</label>
        <input
          type="password"
          value={formData.confirmPassword}
          onChange={(e) => updateField('confirmPassword', e.target.value)}
          className="mt-1 block w-full rounded-md border p-2"
        />
        {errors.confirmPassword && <span className="text-red-500 text-sm">{errors.confirmPassword}</span>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="terms"
          checked={formData.acceptTerms}
          onChange={(e) => updateField('acceptTerms', e.target.checked)}
        />
        <label htmlFor="terms" className="text-sm">I accept the terms and conditions</label>
      </div>
      {errors.acceptTerms && <span className="text-red-500 text-sm block">{errors.acceptTerms}</span>}
      <button type="submit" className="w-full bg-green-600 text-white py-2 rounded-md">
        Create Account
      </button>
    </form>
  );
}
