import { useState, useEffect, useCallback } from 'react';

type Profile = {
  id: number;
  displayName: string;
  emailAddress: string;
};

type FetchProfileState = {
  data: Profile | null;
  isLoading: boolean;
  err: string | null;
  reload: () => Promise<void>;
};

export const useFetchProfile = (profileId: number): FetchProfileState => {
  const [data, setData] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/profiles/${profileId}`);
      if (!res.ok) {
        throw new Error(`HTTP error: ${res.status}`);
      }
      const profile = await res.json();
      setData(profile);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  return { data, isLoading, err, reload: loadProfile };
};
