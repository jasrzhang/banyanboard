import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { login } from '../api/usersApi';

const NAME_RE = /^[A-Za-z ]+$/;
const FIELD_ERROR_ID = 'firstName-error';

function isValidFirstName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 30 && NAME_RE.test(trimmed);
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useCurrentUser();
  const [firstName, setFirstName] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [isPending, setIsPending] = useState(false);

  const hasFieldError = fieldError.length > 0;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError('');

    if (!isValidFirstName(firstName)) {
      setFieldError('Name must be 2–30 letters and spaces only');
      return;
    }
    setFieldError('');
    setIsPending(true);

    try {
      const user = await login(firstName.trim());
      setUser(user);
      navigate('/boards');
    } catch {
      setFormError('Something went wrong. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page">
      <div className="w-full max-w-sm p-8 bg-surface-card rounded-lg shadow-md">
        <h1 className="text-2xl font-semibold text-text-primary mb-6">Log in to BanyanBoard</h1>
        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="firstName" className="block text-sm font-medium text-text-secondary mb-1">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isPending}
              aria-invalid={hasFieldError}
              aria-describedby={hasFieldError ? FIELD_ERROR_ID : undefined}
              className="w-full px-3 py-2 border border-border rounded-md text-text-primary bg-surface-page focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {hasFieldError && (
              <span id={FIELD_ERROR_ID} role="alert" className="text-sm text-red-600 mt-1 block">
                {fieldError}
              </span>
            )}
          </div>
          {formError && (
            <p role="alert" className="text-sm text-red-600 mb-4">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="w-full py-2 px-4 bg-primary text-white rounded-md font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Log in
          </button>
        </form>
      </div>
    </div>
  );
}
